const TABS: [string, string][] = [
  ["/", "Current"],
  ["/yesterday", "Yesterday"],
  ["/week", "Week"],
  ["/month", "Month"],
  ["/year", "Year"],
  ["/history", "History"],
  ["/archive", "Archive"],
  ["/almanac", "Almanac"],
];

interface NavTabsProps {
  current: string;
}

export default function NavTabs({ current }: NavTabsProps) {
  return (
    <nav
      class="flex overflow-x-auto"
      style="background-color: var(--color-nav-bg); border-bottom: 1px solid var(--color-card-border);"
    >
      {TABS.map(([href, label]) => {
        const isActive = href === "/"
          ? current === "/"
          : current ? current.startsWith(href) : false;
        return (
          <a
            key={href}
            href={href}
            class={[
              "px-4 py-2 text-sm font-medium whitespace-nowrap transition-opacity",
              isActive
                ? "border-b-2 border-white font-semibold"
                : "opacity-70 hover:opacity-100",
            ].join(" ")}
            style="color: var(--color-nav-text);"
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
