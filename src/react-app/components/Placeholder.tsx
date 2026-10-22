export default function ConcretagemInProgress() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-surgir">
      <div className="w-24 h-24 bg-amber-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
        <span className="text-4xl">🏗️</span>
      </div>
      <h2 className="text-2xl font-black text-slate-800 mb-2">Página em fase de planejamento!</h2>
      <p className="text-slate-500 font-medium max-w-sm">
        O engenheiro dev está programando o concreto e não teve tempo de terminar essa página ainda. 
        Volte depois da concretagem! 👷‍♂️
      </p>
    </div>
  );
}