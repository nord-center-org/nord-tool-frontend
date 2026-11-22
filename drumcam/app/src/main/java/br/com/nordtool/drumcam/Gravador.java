package br.com.nordtool.drumcam;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageFormat;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.graphics.SurfaceTexture;
import android.graphics.YuvImage;
import android.hardware.Camera;
import android.media.AudioManager;
import android.media.CamcorderProfile;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.SystemClock;
import android.util.Log;
import android.view.Surface;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Callable;
import java.util.concurrent.FutureTask;

/**
 * Câmera e gravação pela API antiga ({@link Camera} + {@link MediaRecorder}): é a que funciona igual
 * do Android 5 ao 15, sem bibliotecas. Tudo roda numa thread própria; os métodos públicos esperam o fim.
 */
@SuppressWarnings("deprecation")
final class Gravador {

    private static final String TAG = "Drumcam";
    /** Abaixo do limite de 4 GB do MP4 de muitos aparelhos; ao chegar nele, continua num arquivo "-p2". */
    private static final long TAMANHO_MAXIMO = 3_800_000_000L;
    /** A prévia fecha a câmera sozinha se ninguém pedir imagem nesse tempo (economiza bateria e calor). */
    private static final long PREVIA_OCIOSA_MS = 20_000;

    private final Context contexto;
    private final Handler handler;
    private Camera camera;
    private int cameraId = -1;
    private SurfaceTexture textura;
    private MediaRecorder gravador;
    private File arquivo;
    private String base;
    private int parte;
    private long inicio;
    private volatile byte[] previa;
    private volatile long previaPedidaEm;
    private long ultimoQuadro;
    private int rotacao;
    private volatile String erro;

    Gravador(Context contexto) {
        this.contexto = contexto.getApplicationContext();
        HandlerThread thread = new HandlerThread("camera");
        thread.start();
        handler = new Handler(thread.getLooper());
        handler.postDelayed(this::verificarPreviaOciosa, 5_000);
    }

    // ---------- estado ----------

    synchronized boolean gravando() {
        return gravador != null;
    }

    synchronized long inicio() {
        return inicio;
    }

    synchronized String arquivoAtual() {
        return arquivo == null ? null : arquivo.getName();
    }

    String erro() {
        return erro;
    }

    // ---------- prévia ----------

    /** Última imagem da prévia (JPEG). Abre a câmera se preciso; durante a gravação devolve null. */
    byte[] previa() throws Exception {
        previaPedidaEm = SystemClock.elapsedRealtime();
        executar(() -> {
            if (gravador == null && camera == null) abrirPrevia();
            return null;
        });
        return gravador == null ? previa : null;
    }

    private void abrirPrevia() throws Exception {
        abrirCamera(false);
        camera.setPreviewCallback((dados, cam) -> {
            long agora = SystemClock.elapsedRealtime();
            if (agora - ultimoQuadro < 700) return;
            ultimoQuadro = agora;
            try {
                Camera.Size t = cam.getParameters().getPreviewSize();
                YuvImage yuv = new YuvImage(dados, ImageFormat.NV21, t.width, t.height, null);
                ByteArrayOutputStream saida = new ByteArrayOutputStream();
                yuv.compressToJpeg(new Rect(0, 0, t.width, t.height), 70, saida);
                previa = girar(saida.toByteArray(), rotacao);
            } catch (RuntimeException e) {
                Log.w(TAG, "quadro da prévia", e);
            }
        });
        camera.startPreview();
    }

    private synchronized void verificarPreviaOciosa() {
        if (gravador == null && camera != null
                && SystemClock.elapsedRealtime() - previaPedidaEm > PREVIA_OCIOSA_MS) {
            fecharCamera();
            previa = null;
        }
        handler.postDelayed(this::verificarPreviaOciosa, 5_000);
    }

    private static byte[] girar(byte[] jpeg, int graus) {
        if (graus == 0) return jpeg;
        Bitmap original = BitmapFactory.decodeByteArray(jpeg, 0, jpeg.length);
        if (original == null) return jpeg;
        Matrix m = new Matrix();
        m.postRotate(graus);
        Bitmap girado = Bitmap.createBitmap(original, 0, 0, original.getWidth(), original.getHeight(), m, true);
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        girado.compress(Bitmap.CompressFormat.JPEG, 70, saida);
        original.recycle();
        girado.recycle();
        return saida.toByteArray();
    }

    // ---------- gravação ----------

    /** Começa a gravar. Devolve o nome do arquivo. */
    String iniciar() throws Exception {
        return executar(() -> {
            if (gravador != null) return arquivo.getName();
            erro = null;
            base = "drumcam-" + new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(new Date());
            parte = 1;
            inicio = System.currentTimeMillis();
            comecar();
            return arquivo.getName();
        });
    }

    /** Para de gravar. Devolve o nome do último arquivo (ou null se não estava gravando). */
    String parar() throws Exception {
        return executar(() -> {
            if (gravador == null) return null;
            String nome = arquivo.getName();
            terminar();
            fecharCamera();
            return nome;
        });
    }

    private void comecar() throws Exception {
        JSONObject ajustes = Config.ajustes(contexto);
        boolean cru = "cru".equals(ajustes.optString("audio"));
        try {
            prepararEIniciar(ajustes, cru);
        } catch (Exception e) {
            if (!cru) throw e;
            // Áudio sem processamento não é aceito em todo aparelho: tenta com o padrão.
            Log.w(TAG, "áudio sem processamento recusado; usando o padrão", e);
            prepararEIniciar(ajustes, false);
        }
    }

    private void prepararEIniciar(JSONObject ajustes, boolean audioCru) throws Exception {
        if (camera != null) camera.setPreviewCallback(null);
        else abrirCamera(true);
        previa = null;

        Camera.Parameters p = camera.getParameters();
        p.setRecordingHint(true);
        List<String> focos = p.getSupportedFocusModes();
        if (focos != null && focos.contains(Camera.Parameters.FOCUS_MODE_CONTINUOUS_VIDEO)) {
            p.setFocusMode(Camera.Parameters.FOCUS_MODE_CONTINUOUS_VIDEO);
        }
        if (p.isVideoStabilizationSupported()) p.setVideoStabilization(true);
        try {
            camera.setParameters(p);
        } catch (RuntimeException e) {
            Log.w(TAG, "parâmetros de vídeo recusados", e);
        }
        camera.startPreview();
        camera.unlock();

        CamcorderProfile perfil = perfil(ajustes.optString("qualidade", "1080"));
        arquivo = new File(Videos.pasta(contexto), base + (parte > 1 ? "-p" + parte : "") + ".mp4");

        MediaRecorder r = new MediaRecorder();
        try {
            r.setCamera(camera);
            r.setAudioSource(fonteAudio(audioCru));
            r.setVideoSource(MediaRecorder.VideoSource.CAMERA);
            r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            r.setVideoFrameRate(perfil.videoFrameRate);
            r.setVideoSize(perfil.videoFrameWidth, perfil.videoFrameHeight);
            int teto = perfil.videoFrameHeight >= 1080 ? 12_000_000 : 6_000_000;
            r.setVideoEncodingBitRate(Math.min(perfil.videoBitRate, teto));
            r.setVideoEncoder(MediaRecorder.VideoEncoder.H264);
            r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            r.setAudioEncodingBitRate(192_000);
            r.setAudioSamplingRate(perfil.audioSampleRate);
            r.setAudioChannels(perfil.audioChannels);
            r.setOrientationHint(rotacao);
            r.setMaxFileSize(TAMANHO_MAXIMO);
            r.setOutputFile(arquivo.getAbsolutePath());
            r.setPreviewDisplay(new Surface(textura));
            r.setOnInfoListener((mr, oQue, extra) -> {
                if (oQue == MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED) continuarEmNovaParte();
            });
            r.setOnErrorListener((mr, oQue, extra) -> {
                synchronized (Gravador.this) {
                    erro = "A gravação parou por um erro da câmera (" + oQue + "/" + extra + ").";
                    Log.e(TAG, erro);
                    terminar();
                    fecharCamera();
                }
            });
            r.prepare();
            r.start();
            gravador = r;
            Videos.salvarMeta(contexto, arquivo.getName(), new JSONObject().put("gravandoDesde", inicio));
        } catch (Exception e) {
            r.reset();
            r.release();
            try {
                camera.lock();
            } catch (RuntimeException ignorado) {
                // a câmera pode já ter caído
            }
            fecharCamera();
            if (arquivo.length() == 0) arquivo.delete();
            arquivo = null;
            erro = "Não consegui começar a gravar: " + e.getMessage();
            throw e;
        }
    }

    private void continuarEmNovaParte() {
        handler.post(() -> {
            synchronized (Gravador.this) {
                if (gravador == null) return;
                terminar();
                parte++;
                try {
                    comecar();
                } catch (Exception e) {
                    erro = "A gravação parou ao trocar de arquivo: " + e.getMessage();
                    fecharCamera();
                }
            }
        });
    }

    /** Fecha o arquivo atual e grava duração e tamanho. Não fecha a câmera. */
    private void terminar() {
        MediaRecorder r = gravador;
        gravador = null;
        File f = arquivo;
        if (r == null) return;
        try {
            r.stop();
        } catch (RuntimeException e) {
            // stop() falha quando quase nada foi gravado: o arquivo não presta
            Log.w(TAG, "stop", e);
            if (f != null) f.delete();
        }
        r.reset();
        r.release();
        try {
            camera.lock();
        } catch (RuntimeException ignorado) {
            // segue para fechar
        }
        if (f != null && f.exists()) {
            try {
                JSONObject meta = Videos.meta(contexto, f.getName());
                meta.remove("gravandoDesde");
                meta.put("gravadoEm", inicio);
                Videos.salvarMeta(contexto, f.getName(), meta);
                Videos.completarDuracao(contexto, f);
            } catch (Exception e) {
                Log.w(TAG, "meta", e);
            }
        } else if (f != null) {
            Videos.apagar(contexto, f.getName());
        }
    }

    // ---------- câmera ----------

    private void abrirCamera(boolean paraGravar) throws Exception {
        if (camera != null) return;
        cameraId = cameraTraseira();
        camera = Camera.open(cameraId);
        rotacao = calcularRotacao();
        Camera.Parameters p = camera.getParameters();
        CamcorderProfile perfil = perfil(Config.ajustes(contexto).optString("qualidade", "1080"));
        Camera.Size tamanho = tamanhoPrevia(p.getSupportedPreviewSizes(),
                (double) perfil.videoFrameWidth / perfil.videoFrameHeight, paraGravar ? perfil.videoFrameWidth : 960);
        if (tamanho != null) p.setPreviewSize(tamanho.width, tamanho.height);
        List<String> focos = p.getSupportedFocusModes();
        if (focos != null && focos.contains(Camera.Parameters.FOCUS_MODE_CONTINUOUS_VIDEO)) {
            p.setFocusMode(Camera.Parameters.FOCUS_MODE_CONTINUOUS_VIDEO);
        }
        try {
            camera.setParameters(p);
        } catch (RuntimeException e) {
            Log.w(TAG, "parâmetros da prévia recusados", e);
        }
        if (textura == null) textura = new SurfaceTexture(10);
        camera.setPreviewTexture(textura);
    }

    private void fecharCamera() {
        if (camera == null) return;
        try {
            camera.setPreviewCallback(null);
            camera.stopPreview();
        } catch (RuntimeException ignorado) {
            // já parada
        }
        camera.release();
        camera = null;
    }

    private static int cameraTraseira() {
        Camera.CameraInfo info = new Camera.CameraInfo();
        for (int i = 0; i < Camera.getNumberOfCameras(); i++) {
            Camera.getCameraInfo(i, info);
            if (info.facing == Camera.CameraInfo.CAMERA_FACING_BACK) return i;
        }
        return 0;
    }

    /** Graus para o vídeo ficar em pé: celular em pé (retrato) ou deitado com a parte de cima para a esquerda. */
    private int calcularRotacao() {
        Camera.CameraInfo info = new Camera.CameraInfo();
        Camera.getCameraInfo(cameraId, info);
        int aparelho = "paisagem".equals(Config.ajustes(contexto).optString("orientacao")) ? 90 : 0;
        if (info.facing == Camera.CameraInfo.CAMERA_FACING_FRONT) {
            return (info.orientation + aparelho) % 360;
        }
        return (info.orientation - aparelho + 360) % 360;
    }

    private CamcorderProfile perfil(String qualidade) {
        int id = cameraId < 0 ? cameraTraseira() : cameraId;
        if ("1080".equals(qualidade) && CamcorderProfile.hasProfile(id, CamcorderProfile.QUALITY_1080P)) {
            return CamcorderProfile.get(id, CamcorderProfile.QUALITY_1080P);
        }
        if (CamcorderProfile.hasProfile(id, CamcorderProfile.QUALITY_720P)) {
            return CamcorderProfile.get(id, CamcorderProfile.QUALITY_720P);
        }
        return CamcorderProfile.get(id, CamcorderProfile.QUALITY_HIGH);
    }

    private static Camera.Size tamanhoPrevia(List<Camera.Size> tamanhos, double proporcao, int larguraMax) {
        Camera.Size melhor = null;
        double melhorNota = Double.MAX_VALUE;
        for (Camera.Size t : tamanhos) {
            double nota = Math.abs((double) t.width / t.height - proporcao) * 10_000
                    + Math.abs(t.width - larguraMax);
            if (nota < melhorNota) {
                melhorNota = nota;
                melhor = t;
            }
        }
        return melhor;
    }

    private int fonteAudio(boolean cru) {
        if (!cru) return MediaRecorder.AudioSource.CAMCORDER;
        if (Build.VERSION.SDK_INT >= 24) {
            AudioManager am = (AudioManager) contexto.getSystemService(Context.AUDIO_SERVICE);
            if ("true".equals(am.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED))) {
                return MediaRecorder.AudioSource.UNPROCESSED;
            }
        }
        // Sem controle automático de volume na maioria dos aparelhos: bom para bateria.
        return MediaRecorder.AudioSource.VOICE_RECOGNITION;
    }

    /** Resolução que vai sair no vídeo, para mostrar no painel. */
    String resolucao() {
        CamcorderProfile p = perfil(Config.ajustes(contexto).optString("qualidade", "1080"));
        return p.videoFrameHeight + "p";
    }

    // ---------- thread da câmera ----------

    private <T> T executar(Callable<T> tarefa) throws Exception {
        FutureTask<T> f = new FutureTask<>(() -> {
            synchronized (Gravador.this) {
                return tarefa.call();
            }
        });
        handler.post(f);
        try {
            return f.get();
        } catch (java.util.concurrent.ExecutionException e) {
            Throwable causa = e.getCause();
            if (causa instanceof Exception) throw (Exception) causa;
            throw e;
        }
    }
}
