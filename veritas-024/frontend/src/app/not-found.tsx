import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-paper font-mono text-ink text-center">
      <div className="paper-sheet p-8 max-w-md w-full border-2 border-ink space-y-3">
        <span className="stamp-badge !text-xs !border-stamp !text-stamp">
          404 NOT FOUND
        </span>
        <h1 className="text-sm font-bold uppercase tracking-wider">
          PAGE OR ARTIFACT NOT LOCATED
        </h1>
        <p className="text-xs text-ink/70">
          The requested route is not present in the VERITAS-024 5-step guided workflow docket.
        </p>
        <div className="pt-2">
          <Link
            href="/upload"
            className="border-2 border-ink bg-paper px-4 py-1.5 text-xs font-bold uppercase hover:bg-desk inline-block"
          >
            &larr; RETURN TO STEP 1: UPLOAD
          </Link>
        </div>
      </div>
    </div>
  );
}
