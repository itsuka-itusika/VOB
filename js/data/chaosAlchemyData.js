// 混沌錬金窯で錬成できる秘宝と、消費する技術。
// 終盤に使い道のなくなる技術の吐き先でもあるため、要求量は高めにしている。
export const CHAOS_ALCHEMY_KILN_BUILDING_ID = "chaosAlchemyKiln";
export const CHAOS_ALCHEMY_KILN_FLAG = "hasChaosAlchemyKiln";

export const CHAOS_ALCHEMY_RECIPES = [
  {
    techCost: 400,
    treasureIds: ["grotesque_portrait", "pan_flute", "goblin_statue", "lachesis_lot"]
  },
  {
    techCost: 800,
    treasureIds: ["annunciation_painting", "dryad_fruit", "serpent_staff", "book_of_the_dead"]
  },
  {
    techCost: 1200,
    // lachesis_ledger はラケシスの糸車（旧名ラケシスの台帳）。
    treasureIds: ["chronos_elixir", "arcadia_nectar", "lachesis_ledger"]
  }
];
