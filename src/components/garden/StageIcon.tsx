import { Sprout, TreePine, Trophy, Mountain, Wheat, Castle } from "lucide-react";

type Tier = 1 | 2 | 3 | 4 | 5;
type Props = {
  tier: Tier;
  size?: number;
  className?: string;
};

const treeMap: Record<Tier, {
  Icon: typeof Sprout;
  iconName: string;
  iconScale: number;
  bg: string;
  border: string;
  iconColor: string;
}> = {
  1: { Icon: Sprout,    iconName: "sprout",    iconScale: 0.45, bg: "bg-stone-700/40",   border: "border-stone-600",   iconColor: "text-stone-400" },
  2: { Icon: Sprout,    iconName: "sprout",    iconScale: 0.6,  bg: "bg-emerald-900/40", border: "border-emerald-700", iconColor: "text-emerald-300" },
  3: { Icon: TreePine,  iconName: "tree-pine", iconScale: 0.6,  bg: "bg-emerald-700/30", border: "border-emerald-500", iconColor: "text-emerald-200" },
  4: { Icon: TreePine,  iconName: "tree-pine", iconScale: 0.7,  bg: "bg-emerald-600/40 shadow-[0_0_12px_rgba(52,211,153,0.4)]", border: "border-emerald-400", iconColor: "text-emerald-100" },
  5: { Icon: Trophy,    iconName: "trophy",    iconScale: 0.6,  bg: "bg-gradient-to-br from-amber-300 to-amber-500", border: "border-amber-200", iconColor: "text-amber-900" },
};

const farmMap: Record<Tier, {
  Icon: typeof Sprout;
  iconName: string;
  iconScale: number;
  bg: string;
  border: string;
  iconColor: string;
}> = {
  1: { Icon: Mountain, iconName: "mountain",  iconScale: 0.55, bg: "bg-stone-800/40",   border: "border-stone-700",   iconColor: "text-stone-400" },
  2: { Icon: Sprout,   iconName: "sprout",    iconScale: 0.6,  bg: "bg-stone-700/40",   border: "border-emerald-800", iconColor: "text-emerald-300" },
  3: { Icon: TreePine, iconName: "tree-pine", iconScale: 0.6,  bg: "bg-emerald-900/40", border: "border-emerald-600", iconColor: "text-emerald-200" },
  4: { Icon: Wheat,    iconName: "wheat",     iconScale: 0.6,  bg: "bg-amber-900/30",   border: "border-amber-700",   iconColor: "text-amber-300" },
  5: { Icon: Castle,   iconName: "castle",    iconScale: 0.6,  bg: "bg-gradient-to-br from-amber-300 to-amber-500", border: "border-amber-200", iconColor: "text-amber-900" },
};

function StageBadge({
  tier,
  size,
  className,
  config,
}: {
  tier: Tier;
  size: number;
  className?: string;
  config: typeof treeMap[Tier];
}) {
  const { Icon, iconName, iconScale, bg, border, iconColor } = config;
  const iconSize = Math.round(size * iconScale);
  return (
    <span
      key={tier}
      data-stage-tier={tier}
      className={`relative inline-flex items-center justify-center rounded-full border-2 transition-transform hover:scale-105 animate-stage-pop ${bg} ${border} ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      {tier === 5 && (
        <span
          data-stage-halo
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-amber-400/30 blur-md animate-pulse"
        />
      )}
      <Icon
        data-lucide-icon={iconName}
        size={iconSize}
        className={iconColor}
        strokeWidth={2}
      />
    </span>
  );
}

export function TreeStageIcon({ tier, size = 28, className }: Props) {
  return <StageBadge tier={tier} size={size} className={className} config={treeMap[tier]} />;
}

export function FarmStageIcon({ tier, size = 28, className }: Props) {
  return <StageBadge tier={tier} size={size} className={className} config={farmMap[tier]} />;
}
