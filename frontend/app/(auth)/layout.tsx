export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex min-h-dvh flex-col justify-center gap-10 overflow-hidden bg-navy px-4 py-12 sm:px-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-0 lg:px-0 lg:py-0">
      <h1 className="text-4xl leading-tight font-black text-white whitespace-nowrap sm:text-6xl sm:leading-[75px] lg:pl-[100px]">
        Welcome
        <br />
        To
        <br />
        Manian &amp; Rao
      </h1>
      <div className="flex items-center justify-center">{children}</div>
    </main>
  );
}
