import { cn } from "@/lib/utils";

const sizeStyles = {
  sm: {
    root: "gap-2.5",
    mark: "h-10 w-10 rounded-[1rem]",
    inner: "inset-[3px] rounded-[0.78rem]",
    orb: "h-[1.125rem] w-[1.125rem]",
    dot: "h-2.5 w-2.5",
    ribbon: "h-2.5 w-5.5",
    ribbonInner: "h-2.5 w-4",
    sigil: "text-[0.56rem] tracking-[0.26em]",
    word: "text-xl sm:text-2xl",
    caption: "text-[0.52rem]",
  },
  md: {
    root: "gap-3",
    mark: "h-12 w-12 rounded-[1.15rem]",
    inner: "inset-[4px] rounded-[0.95rem]",
    orb: "h-[1.375rem] w-[1.375rem]",
    dot: "h-3 w-3",
    ribbon: "h-3 w-6.5",
    ribbonInner: "h-3 w-4.5",
    sigil: "text-[0.62rem] tracking-[0.3em]",
    word: "text-2xl sm:text-3xl",
    caption: "text-[0.56rem]",
  },
  lg: {
    root: "gap-3.5",
    mark: "h-14 w-14 rounded-[1.35rem]",
    inner: "inset-[4px] rounded-[1.1rem]",
    orb: "h-6 w-6",
    dot: "h-3.5 w-3.5",
    ribbon: "h-3.5 w-7",
    ribbonInner: "h-3.5 w-5",
    sigil: "text-[0.68rem] tracking-[0.34em]",
    word: "text-3xl sm:text-4xl",
    caption: "text-[0.6rem]",
  },
} as const;

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  size?: keyof typeof sizeStyles;
  showTagline?: boolean;
  wordmarkClassName?: string;
};

export function BrandLogo({
  className,
  markClassName,
  size = "md",
  showTagline = false,
  wordmarkClassName,
}: BrandLogoProps) {
  const styles = sizeStyles[size];

  return (
    <div className={cn("group inline-flex items-center", styles.root, className)}>
      <span
        className={cn(
          "relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden border-2 border-foreground bg-gradient-card-pop shadow-brutal-sm transition-transform duration-300 group-hover:-translate-y-0.5",
          styles.mark,
          markClassName,
        )}
      >
        <span
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 18%, rgba(255,255,255,0.72), transparent 32%), radial-gradient(circle at 82% 16%, rgba(255,255,255,0.3), transparent 20%), linear-gradient(145deg, var(--brand-cyan), var(--brand-violet), var(--brand-pink))",
          }}
        />
        <span
          className={cn(
            "absolute border border-white/35 bg-white/10 backdrop-blur-[1px]",
            styles.inner,
          )}
        />
        <span
          className={cn(
            "absolute left-[18%] top-[18%] rounded-full border-2 border-foreground bg-brand-yellow",
            styles.orb,
          )}
        />
        <span
          className={cn(
            "absolute right-[14%] top-[16%] rounded-full border-2 border-foreground bg-background",
            styles.dot,
          )}
        />
        <span
          className={cn(
            "absolute bottom-[18%] left-[18%] rotate-[26deg] rounded-full border-2 border-foreground bg-background/95",
            styles.ribbon,
          )}
        />
        <span
          className={cn(
            "absolute bottom-[24%] left-[33%] -rotate-[24deg] rounded-full border-2 border-foreground bg-brand-lime/90",
            styles.ribbonInner,
          )}
        />
        <span
          className={cn(
            "absolute bottom-[11%] font-display font-bold uppercase text-foreground/80",
            styles.sigil,
          )}
        >
          SZ
        </span>
      </span>

      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "font-display font-bold tracking-[-0.08em] text-foreground",
            styles.word,
            wordmarkClassName,
          )}
        >
          <span className="text-gradient-hero inline-block">Soc</span>
          <span className="ml-0.5 text-foreground">Zen</span>
        </span>
        {showTagline ? (
          <span
            className={cn(
              "mt-1 font-semibold uppercase tracking-[0.28em] text-muted-foreground",
              styles.caption,
            )}
          >
            signal. sync. zen.
          </span>
        ) : null}
      </span>
    </div>
  );
}
