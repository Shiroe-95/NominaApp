export default function UploadLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-400">Preparando pipeline de carga...</span>
      </div>
    </div>
  );
}
