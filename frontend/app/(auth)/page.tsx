import Link from "next/link";

export default function WorkspacePage() {
  return (
    <section className="relative flex aspect-[603/572] w-[22rem] shrink-0 items-center justify-center sm:w-[32rem] lg:w-[min(12rem_+_62vh,860px,46vw)]">
      <div
        aria-hidden="true"
        className="sphere-accent-top absolute top-[-2.6%] left-[57%] aspect-square w-[37.8%] rounded-full"
      />
      <div
        aria-hidden="true"
        className="sphere-accent-bottom absolute top-[55.4%] left-[3.5%] aspect-square w-[47.4%] rounded-full"
      />
      <div
        aria-hidden="true"
        className="sphere-main absolute inset-0 rounded-[50%]"
      />

      <div className="relative flex flex-col items-center text-center">
        <h2 className="text-4xl font-black text-teal lg:text-[44px]">Payroll</h2>
        {/* <p className="mt-2 text-black"></p> */}
        <Link
          href="/admin/login"
          className="mt-10 flex h-12 items-center rounded-full border border-slate-300/70 px-10 font-semibold text-black transition-colors hover:border-navy hover:bg-navy hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
        >
          Go to Payroll
        </Link>
      </div>
    </section>
  );
}
