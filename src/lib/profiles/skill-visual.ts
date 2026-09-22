/**
 * Deterministic, category-inspired gradient accents for user-entered skills.
 * Matches the same color language used for product categories across Oventric.
 */
export const SKILL_HUES = [
  "from-[#6C5CE7] to-[#8E7BFF]",
  "from-[#B84D9B] to-[#E05FAE]",
  "from-[#E07A2F] to-[#F0A05A]",
  "from-[#4B5BD7] to-[#6E7BF0]",
  "from-[#2F7FE0] to-[#4FA3F5]",
  "from-[#D7444C] to-[#F06A72]",
  "from-[#5A6B63] to-[#7C8F86]",
  "from-[#7A34D4] to-[#9B5CF0]",
  "from-[#D63A3A] to-[#F0605F]",
  "from-[#7A6A55] to-[#9E8B70]",
  "from-[#E0662F] to-[#F58C55]",
  "from-[#C7407F] to-[#E9689F]",
  "from-[#2FB09B] to-[#54D3BC]",
  "from-[#3D6FC4] to-[#5F92E8]",
  "from-[#E08A1F] to-[#F5AC49]",
  "from-[#D6423A] to-[#F26B62]",
  "from-[#B0592F] to-[#D57F52]",
  "from-[#D63A6F] to-[#F26896]",
  "from-[#6E3AD6] to-[#9464F2]",
  "from-[#2F8FE0] to-[#57B2F5]",
  "from-[#4A5568] to-[#6B7688]",
  "from-[#8A5A2F] to-[#B07E4F]",
] as const;

export function skillHue(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return SKILL_HUES[Math.abs(hash) % SKILL_HUES.length];
}
