/** Structured Dealer Field Notes (EN/FR). Illustrations are inline SVG keys. */

export type FieldNoteCategory = 'piece' | 'period' | 'stamps' | 'buying';

export type PieceTag =
  | 'commodes'
  | 'mirrors'
  | 'chairs'
  | 'cabinets'
  | 'tables'
  | 'secretaires';

export type PeriodTag =
  | 'louis_xiv_regence'
  | 'louis_xv'
  | 'transition'
  | 'louis_xvi'
  | 'directoire_empire'
  | 'restauration'
  | 'louis_philippe'
  | 'napoleon_iii'
  | 'gustavian'
  | 'georgian_regency';

export type IllustrationId =
  | 'absentee'
  | 'backboards'
  | 'cabinet_doors'
  | 'cabinet_hw'
  | 'cabinet_interior'
  | 'case_stamp'
  | 'cash_cap'
  | 'chair_set'
  | 'condition_report'
  | 'cornice'
  | 'dealer_label'
  | 'dovetails'
  | 'estampille_look'
  | 'fake_stamp'
  | 'fall_front'
  | 'feet'
  | 'frame_joints'
  | 'gilding'
  | 'gueridon'
  | 'invoice'
  | 'jme_mark'
  | 'legs'
  | 'marble_top'
  | 'married'
  | 'mercury_glass'
  | 'mirror_back'
  | 'mirror_size'
  | 'mount_backs'
  | 'nails_screws'
  | 'negotiate'
  | 'oxidation'
  | 'paint_surface'
  | 'payment'
  | 'pegged_joint'
  | 'period_empire'
  | 'period_lp'
  | 'period_n3'
  | 'period_regence'
  | 'period_restauration'
  | 'period_transition'
  | 'period_trap'
  | 'premium'
  | 'saw_marks'
  | 'scam'
  | 'seat_rail_stamp'
  | 'sec_feet'
  | 'sec_interior'
  | 'sec_marble'
  | 'sec_stamp'
  | 'sec_veneer'
  | 'table_apron'
  | 'table_en_fr'
  | 'table_leaves'
  | 'table_leg_join'
  | 'table_top'
  | 'transport'
  | 'webbing';

export interface LocalizedText { en: string; fr: string }

export interface FieldNote {
  id: string;
  category: FieldNoteCategory;
  title: LocalizedText;
  body: LocalizedText;
  illustration: IllustrationId;
  pieceTags: PieceTag[];
  periodTags: PeriodTag[];
  makerRelated: boolean;
  /** Extra search keywords (not shown in UI). */
  keywords: LocalizedText;
}

export const PIECE_TAG_LABELS: Record<PieceTag, LocalizedText> = {
  commodes: { en: 'Chests & commodes', fr: 'Commodes & coffres' },
  mirrors: { en: 'Mirrors', fr: 'Miroirs' },
  chairs: { en: 'Chairs & armchairs', fr: 'Chaises & fauteuils' },
  cabinets: { en: 'Cabinets & armoires', fr: 'Armoires & buffets' },
  tables: { en: 'Tables & consoles', fr: 'Tables & consoles' },
  secretaires: { en: 'Secrétaires', fr: 'Secrétaires' },
};

export const PERIOD_TAG_LABELS: Record<PeriodTag, LocalizedText> = {
  louis_xiv_regence: { en: 'Louis XIV / Régence', fr: 'Louis XIV / Régence' },
  louis_xv: { en: 'Louis XV', fr: 'Louis XV' },
  transition: { en: 'Transition', fr: 'Transition' },
  louis_xvi: { en: 'Louis XVI', fr: 'Louis XVI' },
  directoire_empire: { en: 'Directoire / Empire', fr: 'Directoire / Empire' },
  restauration: { en: 'Restauration', fr: 'Restauration' },
  louis_philippe: { en: 'Louis-Philippe', fr: 'Louis-Philippe' },
  napoleon_iii: { en: 'Napoleon III', fr: 'Napoléon III' },
  gustavian: { en: 'Gustavian / Swedish Rococo', fr: 'Gustavien / rococo suédois' },
  georgian_regency: { en: 'Georgian / Regency (UK)', fr: 'George / Regency (UK)' },
};

export const CATEGORY_LABELS: Record<FieldNoteCategory, LocalizedText> = {
  piece: { en: 'By piece', fr: 'Par type' },
  period: { en: 'By period', fr: 'Par époque' },
  stamps: { en: 'Stamps & makers', fr: 'Estampilles & makers' },
  buying: { en: 'Buying & negotiating', fr: 'Achat & négociation' },
};

export const FIELD_NOTES: FieldNote[] = [
  {
    id: "commode-dovetails",
    category: "piece",
    title: { en: "Drawer dovetails: hand-cut vs machine", fr: "Queues d'aronde des tiroirs : main vs machine" },
    body: { en: "On 18th-century French case furniture, drawer dovetails are usually irregular and cut by hand: pins and tails vary slightly in size and spacing. From the mid-19th century machine-cut dovetails tend to be evenly spaced and identical. Irregularity is a tendency toward earlier work, not absolute proof.", fr: "Sur le mobilier de boiserie français du XVIIIe, les queues d'aronde des tiroirs sont souvent irrégulières et taillées à la main : tailles et écarts varient légèrement. À partir du milieu du XIXe, les queues machine sont généralement régulières et identiques. L'irrégularité oriente vers un travail plus ancien, sans preuve absolue." },
    illustration: "dovetails",
    pieceTags: ["commodes", "secretaires", "cabinets"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "dovetail drawer joints hand-cut", fr: "queue d'aronde tiroir" },
  },
  {
    id: "commode-saw-marks",
    category: "piece",
    title: { en: "Saw marks on drawer bottoms and backs", fr: "Traces de scie sous les tiroirs et au dos" },
    body: { en: "Undersides and backs of period drawers often show straight or slightly curved pit-saw or frame-saw marks. Circular saw arcs are more typical of later work (broadly after the early 19th century in France). Look in unpolished zones the restorer may have left alone.", fr: "Les dessous et dos de tiroirs d'époque montrent souvent des traces de scie à cadre ou à bras, droites ou légèrement courbes. Les arcs de scie circulaire sont plutôt d'un travail plus tardif (en France, souvent après le début du XIXe). Cherchez les zones non repeintes." },
    illustration: "saw_marks",
    pieceTags: ["commodes", "secretaires", "cabinets", "tables"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "circular saw pit saw marks", fr: "scie circulaire traces" },
  },
  {
    id: "commode-oxidation",
    category: "piece",
    title: { en: "Oxidation and colour inside drawers", fr: "Oxydation et couleur à l'intérieur des tiroirs" },
    body: { en: "Secondary woods inside a period piece usually oxidise to a warm brown or grey-brown. Fresh pale timber, bright plywood, or uniform new stain on the insides can point to later work, heavy restoration, or a married carcase. Compare colour where light rarely reaches.", fr: "Les bois secondaires d'une pièce d'époque s'oxydent en général vers un brun chaud ou gris-brun. Un bois pâle tout neuf, du contreplaqué, ou une teinte uniforme récente à l'intérieur peut indiquer un travail plus tardif, une restauration lourde, ou un assemblage de parties. Comparez les zones peu exposées à la lumière." },
    illustration: "oxidation",
    pieceTags: ["commodes", "secretaires", "cabinets"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "oxidation secondary wood drawer interior", fr: "oxydation bois secondaire" },
  },
  {
    id: "commode-backboards",
    category: "piece",
    title: { en: "Backboards: panels, nails, and later plywood", fr: "Fonds de dos : panneaux, clous et contreplaqué" },
    body: { en: "Period French case pieces often have thin vertical or horizontal backboards, sometimes with old cut nails or forged nails. Sheet plywood, staples, or bright modern screws on the back are usually later. A pristine new back on an otherwise worn carcase is a common red flag.", fr: "Les meubles de boiserie français d'époque ont souvent des fonds de dos minces, verticaux ou horizontaux, parfois fixés par des clous anciens. Contreplaqué, agrafes ou vis modernes brillantes au dos sont généralement plus tardifs. Un dos tout neuf sur une caisse usée est un signal d'alerte fréquent." },
    illustration: "backboards",
    pieceTags: ["commodes", "cabinets", "secretaires"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "backboard plywood nails staples", fr: "fond de dos contreplaqué" },
  },
  {
    id: "commode-mounts",
    category: "piece",
    title: { en: "Bronze mounts: hand-filed backs and old nuts", fr: "Bronzes : revers limés à la main et écrous anciens" },
    body: { en: "Look behind a handle or corner mount. Older mounts often have hand-filed or roughly cast backs and old square nuts or hand-cut threads. Bright identical castings with machine screws, or extra holes under a handle, can mean replaced hardware. Re-gilding alone is common and does not prove the mount is new.", fr: "Regardez derrière une poignée ou une applique d'angle. Les bronzes anciens ont souvent un revers limé ou coulé irrégulier, avec écrou carré ou filetage fait main. Des fontes identiques brillantes avec vis machine, ou des trous supplémentaires sous une poignée, peuvent indiquer un remplacement. Une redorure seule est fréquente et ne prouve pas que le bronze est neuf." },
    illustration: "mount_backs",
    pieceTags: ["commodes", "cabinets", "tables", "secretaires"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "ormolu mount bronze hardware gilding", fr: "bronze doré ormoulu applique" },
  },
  {
    id: "commode-marble",
    category: "piece",
    title: { en: "Marble tops: thickness, moulding, and fit", fr: "Plateaux de marbre : épaisseur, moulure et ajustement" },
    body: { en: "An original marble top usually fits the carcase closely, with a moulded or bevelled edge consistent with the period. A thin modern slab, a large overhang, or a top that clearly belongs to another piece can lower confidence. Check for old chips at the corners and whether the underside shows age.", fr: "Un marbre d'origine épouse en général la caisse de près, avec une moulure ou un chanfrein cohérent avec l'époque. Une dalle moderne mince, un fort débord, ou un plateau visiblement d'un autre meuble diminue la confiance. Vérifiez les éclats anciens aux angles et l'aspect du dessous." },
    illustration: "marble_top",
    pieceTags: ["commodes", "cabinets", "tables"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "marble top Sainte-Anne fit", fr: "marbre plateau Sainte-Anne" },
  },
  {
    id: "commode-married",
    category: "piece",
    title: { en: "Married pieces: top, base, and drawer sets that do not match", fr: "Mariages : dessus, base et tiroirs qui ne concordent pas" },
    body: { en: "A 'married' piece joins parts that were not made together: a later top on an earlier base, mixed drawer sets, or a carcase widened to take a marble. Watch for mismatched wood colour, different dovetail styles between drawers, filler strips, and a marble that sits oddly. Conservatively treat value as closer to the weaker part.", fr: "Un « mariage » assemble des parties qui n'ont pas été conçues ensemble : un dessus plus tardif sur une base ancienne, des tiroirs mélangés, ou une caisse élargie pour un marbre. Attention aux couleurs de bois discordantes, aux queues d'aronde différentes d'un tiroir à l'autre, aux bandes de rattrapage, et à un marbre mal assis. Par prudence, valeurz plutôt près de la partie la plus faible." },
    illustration: "married",
    pieceTags: ["commodes", "cabinets", "tables"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "married piece composite assembled", fr: "mariage meuble composite" },
  },
  {
    id: "mirror-mercury",
    category: "piece",
    title: { en: "Mercury glass vs modern silvering", fr: "Glace au mercure vs étamage moderne" },
    body: { en: "Old mercury-tin glass often looks slightly grey and soft, with blooms, small bubbles, or cloudy patches near the edges. Very bright, sharp modern silvering with a painted back is common on replaced plates. The fingertip test (gap to the reflection) can hint at thicker old glass, but it is only a clue.", fr: "Une glace au mercure ancienne paraît souvent un peu grise et douce, avec des auréoles, de petites bulles ou des voiles près des bords. Un étamage moderne très brillant et net, avec dos peint, est fréquent sur les glaces remplacées. Le test du doigt (écart avec le reflet) peut suggérer un verre plus épais, mais ce n'est qu'un indice." },
    illustration: "mercury_glass",
    pieceTags: ["mirrors"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "mercury glass silvering étamage", fr: "mercure glace étamage" },
  },
  {
    id: "mirror-backboards",
    category: "piece",
    title: { en: "Mirror backs: boards, paper, and modern backing", fr: "Dos de miroir : planches, papiers et fond moderne" },
    body: { en: "Period French mirrors often have wooden backboards (sometimes a single plank) and older paper or dust seals. A factory-sealed modern backing, staples, or brand-new plywood with bright screws should make you question whether the glass—or the whole frame—is recent. Ask for original glass wording on the invoice if the price depends on it.", fr: "Les miroirs français d'époque ont souvent des planches au dos (parfois une seule) et d'anciens papiers ou joints. Un fond d'usine moderne, des agrafes, ou un contreplaqué neuf avec vis brillantes doit faire douter de la glace—ou du cadre entier. Demandez la mention de glace d'origine sur la facture si le prix en dépend." },
    illustration: "mirror_back",
    pieceTags: ["mirrors"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "mirror back plank boards", fr: "dos miroir planche" },
  },
  {
    id: "mirror-regilding",
    category: "piece",
    title: { en: "Gilding and later cream paint on frames", fr: "Dorure et peinture crème plus tardive sur les cadres" },
    body: { en: "Many 19th-century giltwood frames were later painted cream or off-white. That finish is common and usually lowers value versus original gilding, but it does not by itself prove the frame is fake. Look for worn gilding in recesses, bole colour under chips, and whether carving sharpness matches the claimed period.", fr: "Beaucoup de cadres en bois doré du XIXe ont été peints plus tard en crème. Cette finition est fréquente et vaut en général moins qu'une dorure d'origine, sans prouver à elle seule que le cadre est faux. Cherchez la dorure usée dans les creux, la couleur du bol sous les éclats, et si la netteté de la sculpture correspond à l'époque annoncée." },
    illustration: "gilding",
    pieceTags: ["mirrors", "chairs", "tables"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "gilding regilding cream paint bole", fr: "dorure redorure peinture crème" },
  },
  {
    id: "mirror-joints",
    category: "piece",
    title: { en: "Frame joints and corner blocks on mirrors", fr: "Assemblages et coins de cadres de miroirs" },
    body: { en: "Period frames often show mitres with old glue blocks or hand-cut joinery at the corners. Bright metal plates, modern brackets, or fresh glue everywhere can indicate a rebuild. A crest that looks sharper or newer than the rest of the frame may be a later addition—common on Provençal and Paris frames alike.", fr: "Les cadres d'époque montrent souvent des onglets avec anciens tasseaux collés ou assemblages faits main. Plaques métalliques brillantes, équerres modernes ou colle fraîche partout peuvent indiquer une reprise. Un fronton plus net ou plus neuf que le reste du cadre peut être un ajout—fréquent sur les cadres provençaux comme parisiens." },
    illustration: "frame_joints",
    pieceTags: ["mirrors"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "crest fronton mitre frame", fr: "fronton onglet cadre" },
  },
  {
    id: "mirror-size-value",
    category: "piece",
    title: { en: "Size and type matter more than '19th century' alone", fr: "La taille et le type comptent plus que « XIXe » seul" },
    body: { en: "Large Louis-Philippe mirrors (roughly 1.5 m+ in height) and earlier carved giltwood frames trade differently from small later looking-glasses. Shop prices for large period frames with plausible original glass often sit above Drouot hammer levels. Compare like with like: period, size, glass, and finish.", fr: "Les grands miroirs Louis-Philippe (environ 1,5 m et plus) et les cadres sculptés plus anciens se négocient autrement que les petites glaces tardives. En magasin, un grand cadre d'époque avec glace d'origine plausible vaut souvent plus que les adjugés Drouot. Comparez le comparable : époque, taille, glace et finition." },
    illustration: "mirror_size",
    pieceTags: ["mirrors"],
    periodTags: ["louis_philippe"],
    makerRelated: false,
    keywords: { en: "Louis-Philippe large mirror value", fr: "Louis-Philippe grand miroir" },
  },
  {
    id: "mirror-invoice",
    category: "piece",
    title: { en: "Get original glass written on the invoice", fr: "Faites écrire la glace d'origine sur la facture" },
    body: { en: "If the price assumes mercury or original glass, ask the dealer to write a clear phrase such as « glace au mercure d'origine, époque XIXe » (or the claimed period). A vague « certified genuine » without specifics is weak protection if you later find modern silvering.", fr: "Si le prix suppose une glace au mercure ou d'origine, demandez une formule claire du type « glace au mercure d'origine, époque XIXe » (ou l'époque annoncée). Un vague « authentique certifié » sans détail protège mal si vous découvrez un étamage moderne." },
    illustration: "invoice",
    pieceTags: ["mirrors"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "invoice glass wording certified", fr: "facture glace mention" },
  },
  {
    id: "chair-seat-rail",
    category: "piece",
    title: { en: "Seat rails: the first place to look for a stamp", fr: "Traverses d'assise : premier endroit pour un estampille" },
    body: { en: "On French fauteuils and side chairs, maker stamps are most often on the seat rail—commonly the inner face of a side or rear rail, under the upholstery line. Check every chair in a set. One stamped chair does not automatically prove the others, though matching construction helps.", fr: "Sur les fauteuils et chaises français, l'estampille se trouve le plus souvent sur une traverse d'assise—souvent la face intérieure d'une traverse latérale ou arrière, sous la garniture. Vérifiez chaque siège d'une série. Une seule chaise estampillée ne prouve pas automatiquement les autres, même si une construction homogène aide." },
    illustration: "seat_rail_stamp",
    pieceTags: ["chairs"],
    periodTags: [],
    makerRelated: true,
    keywords: { en: "seat rail stamp estampille fauteuil", fr: "traverse assise estampille" },
  },
  {
    id: "chair-webbing",
    category: "piece",
    title: { en: "Webbing, springs, and upholstery clues", fr: "Sangles, ressorts et indices de garniture" },
    body: { en: "Traditional French seats used webbing and stuffed upholstery; coil springs become common in the 19th century. Fresh foam, staples through old rails, or a brand-new webbing job alone do not date the frame, but they do affect cost and can hide the rails where stamps live. Ask to lift a corner of the dust cover.", fr: "Les assises françaises traditionnelles utilisent sangles et garniture garnie ; les ressorts hélicoïdaux se répandent au XIXe. Mousse neuve, agrafes dans de vieilles traverses, ou sanglage tout neuf ne datent pas le bois à eux seuls, mais coûtent et peuvent cacher les estampilles. Demandez à soulever un coin de la toile." },
    illustration: "webbing",
    pieceTags: ["chairs"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "webbing springs upholstery staples", fr: "sangles ressorts garniture agrafes" },
  },
  {
    id: "chair-pegged",
    category: "piece",
    title: { en: "Pegged mortise-and-tenon joints", fr: "Assemblages à tenon-mortaise chevillés" },
    body: { en: "Period chair frames often show pegged mortise-and-tenon joints at the legs and rails. You may see round pegs or slightly proud dowels. Glue-only repairs, metal corner braces screwed on, or loose unpinned joints are worth noting for condition—and sometimes for later manufacture when combined with other clues.", fr: "Les châssis de sièges d'époque montrent souvent des tenons-mortaises chevillés aux pieds et traverses. On peut voir des chevilles rondes un peu saillantes. Réparations uniquement collées, équerres métalliques vissées, ou assemblages lâches sans cheville méritent d'être notés pour l'état—et parfois pour une fabrication plus tardive si d'autres indices vont dans le même sens." },
    illustration: "pegged_joint",
    pieceTags: ["chairs", "tables"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "pegged mortise tenon dowel", fr: "cheville tenon mortaise" },
  },
  {
    id: "chair-legs",
    category: "piece",
    title: { en: "Leg profiles: cabriole, tapered, sabre, and turned", fr: "Profils de pieds : cabriole, fuseau, sabre et tourné" },
    body: { en: "Cabriole legs suit Régence/Louis XV; fluted tapered legs suit Louis XVI; sabre or sabre-inspired rear legs appear in Directoire/Empire seating; heavy turned or baluster legs are common later. A mixed set of leg types in one 'set' is a reason to slow down. Carving sharpness and wear under the feet should agree with the story.", fr: "Le pied cabriole convient à la Régence/Louis XV ; le fuseau cannelé au Louis XVI ; le pied sabre ou inspiré du sabre apparaît au Directoire/Empire ; pieds tournés lourds plus tardifs. Un « ensemble » aux pieds mélangés invite à la prudence. Netteté de sculpture et usure sous les pieds doivent coller au récit." },
    illustration: "legs",
    pieceTags: ["chairs", "tables"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "cabriole fluted sabre leg", fr: "cabriole fuseau sabre pied" },
  },
  {
    id: "chair-set-matching",
    category: "piece",
    title: { en: "Matching a set of chairs", fr: "Homogénéité d'une série de chaises" },
    body: { en: "In a claimed set, compare rail thickness, carve patterns, seat proportions, wood and patina, and any stamps. Dealers sometimes assemble 'sets' from close cousins. Paying a set premium only makes sense if construction and wear look genuinely of a piece.", fr: "Dans une série annoncée, comparez épaisseur des traverses, motifs sculptés, proportions d'assise, bois et patine, et toute estampille. On assemble parfois des « séries » de cousins proches. Une prime de série n'a de sens que si construction et usure paraissent vraiment d'un même ensemble." },
    illustration: "chair_set",
    pieceTags: ["chairs"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "set of chairs matching suite", fr: "série fauteuils ensemble" },
  },
  {
    id: "chair-nails-screws",
    category: "piece",
    title: { en: "Nails vs screws in chair repairs", fr: "Clous vs vis dans les reprises de sièges" },
    body: { en: "Old cut or wrought nails and wooden pegs are expected in early frames. Bright Phillips screws, staples in the rails, or modern brackets are usually repairs or later work. A few honest old repairs are normal; a frame held together only by modern fasteners deserves a lower offer.", fr: "Clous découpés ou forgés et chevilles de bois sont attendus sur les châssis anciens. Vis cruciformes brillantes, agrafes dans les traverses ou équerres modernes sont en général des reprises ou un travail plus tardif. Quelques réparations anciennes honnêtes sont normales ; un châssis tenu seulement par de la quincaillerie moderne mérite une offre plus basse." },
    illustration: "nails_screws",
    pieceTags: ["chairs", "tables", "commodes"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "nails screws phillips staples", fr: "clous vis cruciforme agrafes" },
  },
  {
    id: "cabinet-doors",
    category: "piece",
    title: { en: "Door panels, raised fields, and later glass", fr: "Panneaux de portes, champs relevés et verres plus tardifs" },
    body: { en: "Period armoires and buffets often have raised or flat panels with shrinkage and old tool marks. Later glass doors, bright new hinges, or panels that look factory-sanded can be replacements. Check whether lock plates and keyholes show age consistent with the carcase.", fr: "Armoires et buffets d'époque ont souvent des panneaux plats ou à champ relevé, avec retrait du bois et traces d'outils. Portes vitrées plus tardives, charnières neuves brillantes, ou panneaux poncés « usine » peuvent être des remplacements. Vérifiez si entrées de serrure et cache-entrée ont un âge cohérent avec la caisse." },
    illustration: "cabinet_doors",
    pieceTags: ["cabinets"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "armoire buffet panel door", fr: "armoire buffet panneau porte" },
  },
  {
    id: "cabinet-interior",
    category: "piece",
    title: { en: "Interiors: shelves, peg holes, and later fittings", fr: "Intérieurs : tablettes, trous de cheville et aménagements" },
    body: { en: "Original interiors may show adjustable shelf peg holes, old nails, and oxidised secondary wood. Fresh whitewood shelves, metal kitchen fittings, or a fully relined interior are common updates. They matter more for honesty of the piece than for dating alone.", fr: "Un intérieur d'origine peut montrer des trous de crémaillère, d'anciens clous et un bois secondaire oxydé. Tablettes en sapin neuf, ferrures de cuisine ou intérieur entièrement re-doublé sont des mises à jour fréquentes. Elles comptent surtout pour l'honnêteté du meuble, plus que pour la seule datation." },
    illustration: "cabinet_interior",
    pieceTags: ["cabinets", "secretaires"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "shelves interior peg holes", fr: "tablettes intérieur crémaillère" },
  },
  {
    id: "cabinet-cornice",
    category: "piece",
    title: { en: "Cornices, plinths, and two-part carcases", fr: "Corniches, plinthes et caisses en deux corps" },
    body: { en: "Many tall cabinets are two-part. Check that cornice mouldings, side profiles, and backboards agree between upper and lower. A cornice from another piece, or a plinth rebuilt in softwood, is common. Swedish and French provincial examples both show this pattern.", fr: "Beaucoup de grands meubles sont en deux corps. Vérifiez que corniche, profils latéraux et fonds de dos concordent entre haut et bas. Une corniche d'un autre meuble, ou une plinthe reprise en bois tendre, est fréquente. Les exemples provinciaux français et suédois montrent ce schéma." },
    illustration: "cornice",
    pieceTags: ["cabinets"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "cornice plinth two-part högskåp", fr: "corniche plinthe deux corps" },
  },
  {
    id: "cabinet-hardware",
    category: "piece",
    title: { en: "Locks, hinges, and iron mounts on cabinets", fr: "Serrures, charnières et ferrures de meubles" },
    body: { en: "Period iron locks and hinges often show hand filing and old key wards. Matching keys are a plus but not required. Bright brass butt hinges stamped with modern sizes, or empty filled hinge scars, suggest door or hardware changes. On painted Swedish cupboards, original ironwork is part of the value.", fr: "Serrures et charnières de fer d'époque montrent souvent un limage à la main et d'anciens pannetons. Des clés assorties sont un plus, pas une obligation. Charnières laiton neuves aux dimensions modernes, ou anciennes traces de charnières rebouchées, suggèrent des changements. Sur les armoires peintes suédoises, les ferrures d'origine font partie de la valeur." },
    illustration: "cabinet_hw",
    pieceTags: ["cabinets"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "lock hinge iron mounts", fr: "serrure charnière ferrure" },
  },
  {
    id: "cabinet-paint",
    category: "piece",
    title: { en: "Original paint vs later overpaint on provincial cabinets", fr: "Peinture d'origine vs repeint sur meubles provinciaux" },
    body: { en: "Gustavian and French provincial cabinets are often valued for original or early paint. Thick modern enamel, roller texture, or a colour fashionably distressed last year should be priced as decorative, not as untouched period surface. Edge wear and oxidised paint in recesses are more persuasive than uniform 'antique white'.", fr: "Armoires gustaviennes et provinciales françaises sont souvent prisées pour une peinture d'origine ou ancienne. Email moderne épais, texture au rouleau, ou blanc « vieilli » à la mode récente se valorisent comme décoratif, non comme surface d'époque intacte. L'usure des arêtes et la peinture oxydée dans les creux convainquent plus qu'un blanc antique uniforme." },
    illustration: "paint_surface",
    pieceTags: ["cabinets"],
    periodTags: ["gustavian"],
    makerRelated: false,
    keywords: { en: "original paint Gustavian overpaint", fr: "peinture d'origine gustavien" },
  },
  {
    id: "cabinet-feet",
    category: "piece",
    title: { en: "Feet, skirting, and later castors", fr: "Pieds, bas de caisse et roulettes plus tardives" },
    body: { en: "Feet take the abuse. Replaced bun feet, cut-down legs, or added castors are common and should be disclosed in your own notes. Fresh softwood blocks under an old carcase are repairs, not period construction. Price accordingly when the silhouette was altered.", fr: "Les pieds encaissent les chocs. Pieds en boule remplacés, pieds raccourcis ou roulettes ajoutées sont fréquents et à noter. Des tasseaux de bois tendre neufs sous une vieille caisse sont des reprises, pas la construction d'origine. Ajustez le prix si la silhouette a changé." },
    illustration: "feet",
    pieceTags: ["cabinets", "commodes", "tables"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "feet castors cut-down plinth", fr: "pieds roulettes plinthe" },
  },
  {
    id: "table-top-joints",
    category: "piece",
    title: { en: "Table tops: boards, breadboard ends, and veneers", fr: "Plateaux : planches, barrettes et placages" },
    body: { en: "Solid tops may show joined boards with old movement; breadboard ends appear on some English and later tables. Thin modern veneer over particle board is a different product. Feel the underside: oxidised hand-tool marks support an older top; clean router marks and fresh screws suggest later work.", fr: "Un plateau massif peut montrer des planches assemblées avec retrait ancien ; des barrettes d'extrémité existent sur certaines tables anglaises ou plus tardives. Un placage moderne mince sur panneau de particules est un autre produit. Touchez le dessous : traces d'outils oxydées vont vers un plateau ancien ; marques de toupie nettes et vis neuves vers un travail plus tardif." },
    illustration: "table_top",
    pieceTags: ["tables"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "table top breadboard veneer", fr: "plateau table barrette placage" },
  },
  {
    id: "table-aprons",
    category: "piece",
    title: { en: "Aprons, stretchers, and console backs", fr: "Ceintures, entretoises et dos de consoles" },
    body: { en: "Check that apron height, mouldings, and stretchers agree with the claimed period. Consoles often have unfinished or panelled backs meant for a wall—fresh finishing on the back of a 'console' can mean it was a table cut down. Loose stretchers are a condition issue; missing stretchers on a 'period' base are a bigger one.", fr: "Vérifiez que hauteur de ceinture, moulures et entretoises collent à l'époque annoncée. Les consoles ont souvent un dos brut ou panneauté pour le mur—un dos fraîchement fini sur une « console » peut indiquer une table coupée. Entretoises lâches : état ; entretoises absentes sur une base « d'époque » : plus grave." },
    illustration: "table_apron",
    pieceTags: ["tables"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "apron stretcher console", fr: "ceinture entretoise console" },
  },
  {
    id: "table-leaves",
    category: "piece",
    title: { en: "Leaves, pull-out systems, and later tops", fr: "Allonges, systèmes à tirettes et plateaux plus tardifs" },
    body: { en: "Extension systems wear in characteristic ways: runners, clips, and leaf edges. Leaves that do not match the main top's timber or patina may be replacements. A spectacular marble on a modest base—or the reverse—deserves the married-piece check.", fr: "Les systèmes à allonge s'usent de façon caractéristique : glissières, taquets, chants des allonges. Des allonges dont le bois ou la patine ne collent pas au plateau central peuvent être des remplacements. Un marbre spectaculaire sur une base modeste—ou l'inverse—mérite le contrôle « mariage »." },
    illustration: "table_leaves",
    pieceTags: ["tables"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "extension leaves pull-out", fr: "allonges tirette" },
  },
  {
    id: "table-leg-joinery",
    category: "piece",
    title: { en: "How legs meet the frieze", fr: "Comment les pieds rejoignent la frise" },
    body: { en: "Period joinery at the top of the leg (pegged tenons, wooden blocks) should look consistent around the table. Metal corner braces are common repairs. Four different screw patterns at four corners can mean a rebuilt frieze. Flip the table when the dealer allows it.", fr: "L'assemblage en tête de pied (tenons chevillés, tasseaux de bois) doit paraître cohérent tout autour. Les équerres métalliques sont des reprises fréquentes. Quatre schémas de vis différents aux quatre coins peuvent indiquer une frise reprise. Retournez la table si le marchand le permet." },
    illustration: "table_leg_join",
    pieceTags: ["tables"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "frieze leg block brace", fr: "frise tasseau équerre" },
  },
  {
    id: "table-gu\u00e9ridon",
    category: "piece",
    title: { en: "Guéridons and small stands: proportion and stability", fr: "Guéridons et petites tables : proportion et stabilité" },
    body: { en: "Small stands are frequently over-restored or reproduced. Check proportion (top diameter vs height), the logic of the pedestal or tripod, and whether the top rotates or tilts as claimed. Hairline marble cracks are common; a brand-new top on an old base should be priced as such.", fr: "Les petites tables sont souvent trop restaurées ou reproduites. Vérifiez la proportion (diamètre du plateau / hauteur), la logique du fût ou du tripode, et si le plateau tourne ou bascule comme annoncé. Fêlures de marbre fréquentes ; un plateau neuf sur une base ancienne se valorise comme tel." },
    illustration: "gueridon",
    pieceTags: ["tables"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "guéridon pedestal tilt-top", fr: "guéridon fût tripode" },
  },
  {
    id: "table-english",
    category: "piece",
    title: { en: "English vs French table construction habits", fr: "Habitudes de construction : tables anglaises vs françaises" },
    body: { en: "Georgian and Regency tables often use oak or mahogany with different drawer linings and corner blocks than Paris work. French consoles and guéridons follow other norms for backs and mounts. Do not force a French checklist onto an English table—or the reverse—when reading tool marks and secondary woods.", fr: "Les tables George et Regency utilisent souvent chêne ou acajou avec des tiroirs et tasseaux différents du travail parisien. Consoles et guéridons français suivent d'autres normes pour dos et bronzes. N'appliquez pas une grille française à une table anglaise—ni l'inverse—quand vous lisez traces d'outils et bois secondaires." },
    illustration: "table_en_fr",
    pieceTags: ["tables"],
    periodTags: ["georgian_regency"],
    makerRelated: false,
    keywords: { en: "Georgian Regency mahogany oak", fr: "George Regency acajou chêne" },
  },
  {
    id: "sec-fall-front",
    category: "piece",
    title: { en: "Fall fronts: hinges, leather, and writing surface", fr: "Abattants : charnières, cuir et surface d'écriture" },
    body: { en: "A secrétaire's fall should open to a sensible angle with hinges that look capable of the weight. Replaced leather or baize is normal; a warped, cracked fall with bright new piano hinges needs a closer look. Interior cubbies and secret drawers should feel of a piece with the exterior veneers.", fr: "L'abattant d'un secrétaire doit s'ouvrir à un angle logique, avec des charnières capables de porter le poids. Cuir ou feutrine remplacés : normal ; abattant voilé avec charnières piano neuves : à regarder de près. Niches et tiroirs secrets doivent sembler du même esprit que les placages extérieurs." },
    illustration: "fall_front",
    pieceTags: ["secretaires"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "secrétaire fall front writing flap", fr: "secrétaire abattant écritoire" },
  },
  {
    id: "sec-interior-fit",
    category: "piece",
    title: { en: "Interior architecture and later inserts", fr: "Architecture intérieure et inserts plus tardifs" },
    body: { en: "Period interiors have a logic of small drawers and pigeonholes. A crude later insert, plywood dividers, or a removed safe box leave scars. Matching veneer species between interior drawer fronts and the exterior is a good sign; wildly different woods deserve a note.", fr: "Un intérieur d'époque a une logique de petits tiroirs et casiers. Un insert grossier plus tardif, des cloisons en contreplaqué, ou un coffre-fort retiré laissent des traces. Des essences de placage cohérentes entre tiroirs intérieurs et extérieur sont bon signe ; des bois très différents méritent une note." },
    illustration: "sec_interior",
    pieceTags: ["secretaires"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "pigeonhole interior drawers", fr: "casiers tiroirs intérieurs" },
  },
  {
    id: "sec-stamp-location",
    category: "piece",
    title: { en: "Where secrétaires are stamped", fr: "Où les secrétaires sont estampillés" },
    body: { en: "Stamps on secrétaires often appear on the upper edge of a side upright (under the marble if present), on the carcass behind the fall, or on drawer edges. As with other case pieces, a dealer's paper label is not an estampille. Confirm wood and construction before paying a stamp premium.", fr: "L'estampille d'un secrétaire apparaît souvent sur le chant supérieur d'un montant latéral (sous le marbre s'il y en a un), sur la caisse derrière l'abattant, ou sur les chants de tiroirs. Comme ailleurs, une étiquette de marchand n'est pas une estampille. Vérifiez bois et construction avant de payer une prime de signature." },
    illustration: "sec_stamp",
    pieceTags: ["secretaires"],
    periodTags: [],
    makerRelated: true,
    keywords: { en: "stamp location secrétaire upright", fr: "estampille secrétaire montant" },
  },
  {
    id: "sec-marble-cylinder",
    category: "piece",
    title: { en: "Marble tops and cylinder variants", fr: "Plateaux de marbre et variantes à cylindre" },
    body: { en: "Many French secrétaires carry marble tops; cylinders and tambour variants have their own mechanical wear points. A marble that does not follow the plan of the carcase, or a cylinder that binds badly, affects both use and price. Do not confuse a 19th-century 'style Louis XV' secrétaire with an 18th-century one without construction evidence.", fr: "Beaucoup de secrétaires français portent un marbre ; cylindres et rideaux ont leurs points d'usure. Un marbre qui ne suit pas le plan de la caisse, ou un cylindre qui coince, affecte usage et prix. Ne confondez pas un secrétaire « de style Louis XV » du XIXe avec un XVIIIe sans preuves de construction." },
    illustration: "sec_marble",
    pieceTags: ["secretaires"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "cylinder tambour marble secrétaire", fr: "cylindre rideau marbre secrétaire" },
  },
  {
    id: "sec-veneer",
    category: "piece",
    title: { en: "Veneer thickness and pattern on secrétaires", fr: "Épaisseur et motif du placage sur secrétaires" },
    body: { en: "Earlier veneers are often thicker; paper-thin machine veneer is more typical later. Quartered panels, diamond parquetry, and mahogany crotch patterns should be read with the period claim. Bubbling, patching, and sun fade are condition issues—separate them from dating clues.", fr: "Les placages plus anciens sont souvent plus épais ; le placage machine ultra-mince est plutôt tardif. Panneaux en quartier, marqueterie en losanges et motifs de ronce d'acajou se lisent avec l'époque annoncée. Cloques, greffes et insolation sont des questions d'état—à distinguer des indices de datation." },
    illustration: "sec_veneer",
    pieceTags: ["secretaires", "commodes"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "veneer parquetry thickness", fr: "placage marqueterie épaisseur" },
  },
  {
    id: "sec-feet-plinth",
    category: "piece",
    title: { en: "Bracket feet, plinths, and later bases on secrétaires", fr: "Pieds en console, plinthes et bases plus tardives" },
    body: { en: "Bracket feet and shaped plinths are often rebuilt. Compare wood and tool marks on the feet with the carcase sides. A secrétaire that 'gained' Empire feet on a Transition body is a classic marriage. Price the piece you actually have, not the ideal catalogue photo.", fr: "Pieds en console et plinthes galbées sont souvent repris. Comparez bois et traces d'outils des pieds avec les côtés de caisse. Un secrétaire qui a « gagné » des pieds Empire sur un corps Transition est un mariage classique. Prixez la pièce réelle, pas la photo de catalogue idéale." },
    illustration: "sec_feet",
    pieceTags: ["secretaires", "commodes"],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "bracket feet plinth marriage", fr: "pieds console plinthe mariage" },
  },
  {
    id: "per-regence",
    category: "period",
    title: { en: "Louis XIV to Régence: mass, Boulle, and early curves", fr: "Louis XIV à Régence : masse, Boulle et premiers galbes" },
    body: { en: "Late Louis XIV and Régence furniture still feels architectural: strong cornices, gilt bronze, sometimes Boulle marquetry. Régence introduces softer curves and the early cabriole without the full rococo exuberance of Louis XV. Later 'Louis XIV style' pieces are often heavier Victorian interpretations—check secondary woods and mounts.", fr: "Le mobilier de la fin Louis XIV et de la Régence reste architectural : corniches marquées, bronzes dorés, parfois marqueterie Boulle. La Régence assouplit les lignes et introduit le cabriole naissant, sans l'exubérance rocaille du Louis XV. Les pièces « de style Louis XIV » plus tardives sont souvent des interprétations victoriennes plus lourdes—vérifiez bois secondaires et bronzes." },
    illustration: "period_regence",
    pieceTags: [],
    periodTags: ["louis_xiv_regence"],
    makerRelated: false,
    keywords: { en: "Boulle Régence Louis XIV", fr: "Boulle Régence Louis XIV" },
  },
  {
    id: "per-regence-trap",
    category: "period",
    title: { en: "Trap: 19th-century 'Boulle' and Régence revival", fr: "Piège : « Boulle » et revival Régence du XIXe" },
    body: { en: "Napoleon III and later workshops produced abundant Boulle-style and Régence-revival furniture. Tortoise-shell and brass marquetry alone do not make a piece early 18th century. Prefer construction evidence (dovetails, backs, mounts) over surface glitter when the price assumes a period example.", fr: "Les ateliers du Second Empire et après ont produit beaucoup de mobilier de style Boulle ou revival Régence. Écaille et laiton seuls ne font pas un début XVIIIe. Préférez les preuves de construction (queues d'aronde, dos, bronzes) au seul éclat de surface si le prix suppose une pièce d'époque." },
    illustration: "period_trap",
    pieceTags: [],
    periodTags: ["louis_xiv_regence", "napoleon_iii"],
    makerRelated: false,
    keywords: { en: "Boulle revival Napoleon III fake period", fr: "Boulle revival Second Empire" },
  },
  {
    id: "per-louis-xv",
    category: "period",
    title: { en: "Louis XV: asymmetry, cabriole, and rocaille mounts", fr: "Louis XV : asymétrie, cabriole et bronzes rocaille" },
    body: { en: "Period Louis XV (roughly 1730s–1760s) favours bombed façades, cabriole legs, and asymmetrical rocaille mounts. Woods include walnut, rosewood, and bois de violette. A perfectly symmetrical 'Louis XV' with razor-sharp identical mounts and plywood backs is often later style work.", fr: "Le Louis XV d'époque (années 1730–1760 environ) aime les façades galbées, les pieds cabriole et les bronzes rocaille asymétriques. Bois : noyer, palissandre, bois de violette. Un « Louis XV » parfaitement symétrique, aux bronzes identiques ultra-nets et fonds en contreplaqué, est souvent un travail de style plus tardif." },
    illustration: "legs",
    pieceTags: ["commodes", "chairs", "tables"],
    periodTags: ["louis_xv"],
    makerRelated: false,
    keywords: { en: "Louis XV rocaille bombe cabriole", fr: "Louis XV rocaille galbé cabriole" },
  },
  {
    id: "per-louis-xv-style",
    category: "period",
    title: { en: "Period vs 'style Louis XV'", fr: "Époque vs « de style Louis XV »" },
    body: { en: "In French catalogues, « époque Louis XV » and « de style Louis XV » are different claims. Style pieces can be 19th or 20th century. Ask for construction photos and invoice wording. If the seller will only say 'Louis XV' without époque or style, treat dating as unproven.", fr: "Dans les catalogues français, « époque Louis XV » et « de style Louis XV » ne disent pas la même chose. Le style peut être XIXe ou XXe. Demandez photos de construction et libellé de facture. Si le vendeur dit seulement « Louis XV » sans époque ni style, tenez la datation pour non prouvée." },
    illustration: "period_trap",
    pieceTags: [],
    periodTags: ["louis_xv", "napoleon_iii"],
    makerRelated: false,
    keywords: { en: "époque style Louis XV catalogue", fr: "époque style Louis XV catalogue" },
  },
  {
    id: "per-transition",
    category: "period",
    title: { en: "Transition: between rococo and neoclassical", fr: "Transition : entre rocaille et néoclassique" },
    body: { en: "Transition furniture (roughly 1760s) mixes residual curves with straighter legs, geometric marquetry, and early classical mounts. It is a short, commercially abused label. Look for coherent design, not a Louis XV body with Louis XVI legs bolted on—that is often a marriage or a vague shop tag.", fr: "Le mobilier Transition (années 1760 environ) mêle courbes résiduelles, pieds plus droits, marqueterie géométrique et bronzes classiques naissants. L'étiquette est courte et trop utilisée. Cherchez un dessin cohérent, pas un corps Louis XV avec pieds Louis XVI boulonnés—souvent un mariage ou une étiquette vague." },
    illustration: "period_transition",
    pieceTags: [],
    periodTags: ["transition"],
    makerRelated: false,
    keywords: { en: "Transition marquetry geometric", fr: "Transition marqueterie géométrique" },
  },
  {
    id: "per-louis-xvi",
    category: "period",
    title: { en: "Louis XVI: fluted legs, symmetry, and classical ornament", fr: "Louis XVI : pieds cannelés, symétrie et ornement classique" },
    body: { en: "Period Louis XVI work emphasises straight tapered fluted legs, symmetry, and motifs such as guilloche, pearl, and floral sprays. Mahogany becomes more common. Later Directoire simplifies further. Machine-perfect fluting on softwood with modern screws is a typical revival tell.", fr: "Le Louis XVI d'époque mise sur les pieds fuseaux cannelés, la symétrie, guillochis, perles et fleurs. L'acajou se répand. Le Directoire simplifie encore. Des cannelures parfaites « machine » sur bois tendre avec vis modernes sont un indice de revival fréquent." },
    illustration: "legs",
    pieceTags: [],
    periodTags: ["louis_xvi"],
    makerRelated: false,
    keywords: { en: "Louis XVI fluted guilloche mahogany", fr: "Louis XVI cannelé guillochis acajou" },
  },
  {
    id: "per-empire",
    category: "period",
    title: { en: "Directoire and Empire: mahogany, sabre legs, and gilt bronze", fr: "Directoire et Empire : acajou, pieds sabre et bronzes dorés" },
    body: { en: "Empire seating and case furniture often use mahogany with gilt-bronze mounts (palmettes, Egyptianising motifs, classical heads). Sabre rear legs appear on many chairs. Pale fruitwood 'Empire style' suites from much later should not be priced as early 19th-century imperial supply without stamps or strong provenance.", fr: "Sièges et meubles Empire utilisent souvent l'acajou avec bronzes dorés (palmettes, motifs égyptisants, têtes antiques). Les pieds arrière en sabre sont fréquents. Les suites « style Empire » en fruitier pâle beaucoup plus tardives ne se valorisent pas comme fourniture impériale du début XIXe sans estampille ou provenance forte." },
    illustration: "period_empire",
    pieceTags: ["chairs", "commodes"],
    periodTags: ["directoire_empire"],
    makerRelated: false,
    keywords: { en: "Empire Directoire mahogany sabre Bellangé", fr: "Empire Directoire acajou sabre Bellangé" },
  },
  {
    id: "per-empire-stamp",
    category: "period",
    title: { en: "Empire chairs and the stamp premium", fr: "Fauteuils Empire et prime d'estampille" },
    body: { en: "Names such as Bellangé matter when the seat rails are actually stamped. Auction results for stamped mahogany fauteuils can sit well above ordinary Empire chairs. A handwritten dealer label naming a famous maker is not the same evidence—confirm the mark on the wood.", fr: "Des noms comme Bellangé comptent lorsque les traverses sont réellement estampillées. Les résultats pour fauteuils en acajou estampillés peuvent dépasser nettement les Empire ordinaires. Une étiquette manuscrite de marchand n'est pas la même preuve—confirmez la marque dans le bois." },
    illustration: "seat_rail_stamp",
    pieceTags: ["chairs"],
    periodTags: ["directoire_empire"],
    makerRelated: true,
    keywords: { en: "Bellangé stamped Empire chairs", fr: "Bellangé estampillé Empire fauteuils" },
  },
  {
    id: "per-restauration",
    category: "period",
    title: { en: "Restauration: lighter mahogany and discreet classicism", fr: "Restauration : acajou plus léger et classicisme discret" },
    body: { en: "Restauration furniture (c. 1815–1830) often continues Empire ideas with softer lines and less martial ornament. Pale mahogany and veneer quality vary widely. Many pieces are honest but plain; do not pay Empire palace prices for undecorated Restauration work without a reason.", fr: "Le mobilier Restauration (vers 1815–1830) prolonge l'Empire avec des lignes plus douces et moins d'ornement martial. Acajou clair et qualité de placage varient beaucoup. Beaucoup de pièces sont honnêtes mais simples ; ne payez pas des prix de palais Empire pour une Restauration sans ornement sans bonne raison." },
    illustration: "period_restauration",
    pieceTags: [],
    periodTags: ["restauration"],
    makerRelated: false,
    keywords: { en: "Restauration mahogany 1820", fr: "Restauration acajou 1820" },
  },
  {
    id: "per-lp",
    category: "period",
    title: { en: "Louis-Philippe: comfort, volume, and dark veneers", fr: "Louis-Philippe : confort, volume et placages sombres" },
    body: { en: "Louis-Philippe (c. 1830–1848) brings heavier comfortable forms, dark mahogany or rosewood veneers, and plentiful mirrors with rounded upper corners. Much is solid middle-class furniture. Condition of veneer and marble matters; 'Louis-Philippe' is not automatically 'better than Napoleon III'.", fr: "Le Louis-Philippe (vers 1830–1848) apporte des formes confortables plus lourdes, placages d'acajou ou palissandre sombres, et de nombreux miroirs aux angles supérieurs arrondis. Beaucoup est du mobilier bourgeois solide. L'état du placage et du marbre compte ; « Louis-Philippe » n'est pas automatiquement « mieux que Napoléon III »." },
    illustration: "period_lp",
    pieceTags: ["mirrors", "commodes"],
    periodTags: ["louis_philippe"],
    makerRelated: false,
    keywords: { en: "Louis-Philippe mirror veneer", fr: "Louis-Philippe miroir placage" },
  },
  {
    id: "per-n3",
    category: "period",
    title: { en: "Napoleon III: revival styles and blackened wood", fr: "Napoléon III : styles revival et bois noirci" },
    body: { en: "Second Empire workshops revived Louis XV, XVI, Boulle, and Renaissance forms, often in ebonised wood, gilt bronze, and rich upholstery. These can be high quality—but they are 19th-century. Catalogue wording « époque Napoléon III » is honest; selling them as 18th-century is not.", fr: "Les ateliers du Second Empire ravivent Louis XV, XVI, Boulle et Renaissance, souvent en bois noirci, bronzes dorés et riches textiles. La qualité peut être haute—mais c'est du XIXe. « Époque Napoléon III » est honnête ; les vendre comme XVIIIe ne l'est pas." },
    illustration: "period_n3",
    pieceTags: [],
    periodTags: ["napoleon_iii"],
    makerRelated: false,
    keywords: { en: "Napoleon III ebonised revival", fr: "Napoléon III noirci revival" },
  },
  {
    id: "per-gustavian",
    category: "period",
    title: { en: "Gustavian and Swedish Rococo: paint, light woods, restraint", fr: "Gustavien et rococo suédois : peinture, bois clairs, retenue" },
    body: { en: "Gustavian furniture (late 18th–early 19th century Sweden) often shows light woods, fluted legs, and original or early grey/white paint. Swedish Rococo is earlier and more curved. Original paint and iron hardware support value; heavy modern overpaint and replaced interiors should be priced as decorative.", fr: "Le mobilier gustavien (fin XVIIIe–début XIXe suédois) montre souvent bois clairs, pieds cannelés et peinture grise/blanche d'origine ou ancienne. Le rococo suédois est plus tôt et plus galbé. Peinture d'origine et ferrures de fer soutiennent la valeur ; repeint moderne lourd et intérieurs remplacés se valorisent comme décoratifs." },
    illustration: "paint_surface",
    pieceTags: ["cabinets", "chairs", "tables"],
    periodTags: ["gustavian"],
    makerRelated: false,
    keywords: { en: "Gustavian Swedish Rococo högskåp paint", fr: "gustavien rococo suédois peinture" },
  },
  {
    id: "per-georgian",
    category: "period",
    title: { en: "Georgian and Regency UK: mahogany, oak linings, brass", fr: "George et Regency britanniques : acajou, tiroirs chêne, laiton" },
    body: { en: "Georgian case furniture often has oak drawer linings and specific dovetail habits; Regency adds bolder brass and sometimes sabre legs on seating. French checklist points still help (tool marks, oxidation), but stamp culture and timber choices differ. Import costs and different auction markets affect 'good buy' maths.", fr: "Le mobilier George a souvent des tiroirs à fond/chêne et des habitudes de queues d'aronde propres ; le Regency ajoute un laiton plus affirmé et parfois des pieds sabre. Les points de contrôle français aident encore (outils, oxydation), mais culture d'estampille et choix de bois diffèrent. Frais d'import et marchés d'enchères différents changent le calcul du « bon achat »." },
    illustration: "table_en_fr",
    pieceTags: [],
    periodTags: ["georgian_regency"],
    makerRelated: false,
    keywords: { en: "Georgian Regency oak linings brass", fr: "George Regency tiroirs chêne laiton" },
  },
  {
    id: "per-style-trap",
    category: "period",
    title: { en: "General trap: style name without construction", fr: "Piège général : nom de style sans construction" },
    body: { en: "Shop tags often give a style name alone. Your job is to separate surface style from date of make. Prefer invoices that say époque or siècle, support them with dovetails, backs, mounts and glass, and walk away from pressure sales that forbid inspection of the underside.", fr: "Les étiquettes de magasin donnent souvent un style seul. Votre travail est de séparer le style de surface de la date de fabrication. Préférez les factures qui disent époque ou siècle, appuyez-vous sur queues d'aronde, dos, bronzes et glace, et refusez les ventes sous pression qui interdisent de voir le dessous." },
    illustration: "period_trap",
    pieceTags: [],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "style tag construction inspection", fr: "étiquette style construction inspection" },
  },
  {
    id: "stamp-where-chairs",
    category: "stamps",
    title: { en: "Where to find stamps on seating", fr: "Où trouver les estampilles sur les sièges" },
    body: { en: "On fauteuils and chaises, look on the inner faces of the seat rails, sometimes on a rear rail under the upholstery. Check all four chairs in a set. Photograph any mark next to a ruler. Absence of a stamp is normal—most period chairs were never stamped.", fr: "Sur fauteuils et chaises, regardez les faces intérieures des traverses d'assise, parfois une traverse arrière sous la garniture. Vérifiez les quatre d'une série. Photographiez toute marque avec une échelle. L'absence d'estampille est normale—la plupart des sièges d'époque n'en ont jamais eu." },
    illustration: "seat_rail_stamp",
    pieceTags: ["chairs"],
    periodTags: [],
    makerRelated: true,
    keywords: { en: "estampille seat rail where", fr: "estampille traverse où" },
  },
  {
    id: "stamp-where-case",
    category: "stamps",
    title: { en: "Where to find stamps on case furniture", fr: "Où trouver les estampilles sur les meubles de boiserie" },
    body: { en: "On commodes and secrétaires, stamps often sit on the top edge of a side upright (lift or slide the marble with care and permission), sometimes on a carcass rail or drawer edge. Iron JME-type guild marks appear on some 18th-century Paris work. Never force a marble—ask the dealer to show the edges.", fr: "Sur commodes et secrétaires, l'estampille siège souvent sur le chant supérieur d'un montant (soulevez ou faites glisser le marbre avec accord), parfois sur une traverse de caisse ou un chant de tiroir. Des marques de jurande type JME apparaissent sur certains travaux parisiens du XVIIIe. Ne forcez jamais un marbre—demandez au marchand de montrer les chants." },
    illustration: "case_stamp",
    pieceTags: ["commodes", "secretaires", "cabinets"],
    periodTags: [],
    makerRelated: true,
    keywords: { en: "JME stamp upright marble", fr: "JME estampille montant marbre" },
  },
  {
    id: "stamp-genuine-look",
    category: "stamps",
    title: { en: "What a genuine estampille tends to look like", fr: "À quoi ressemble plutôt une vraie estampille" },
    body: { en: "A struck wood stamp is impressed into the fibre: edges may be slightly crushed, ink is not required, and the mark sits under later wax or dirt in recesses. Fresh laser-sharp brands sitting only on a polished surface, or ink stamps on paper labels, are different evidence. When unsure, compare with published marks for that maker.", fr: "Une estampille frappée s'enfonce dans la fibre : bords un peu écrasés, pas besoin d'encre, la marque peut être sous cire ou poussière. Des marques laser ultra-nettes seulement en surface cirée, ou tampons encreurs sur étiquette papier, sont une autre preuve. En cas de doute, comparez aux marques publiées du maker." },
    illustration: "estampille_look",
    pieceTags: [],
    periodTags: [],
    makerRelated: true,
    keywords: { en: "genuine stamp struck wood fibre", fr: "vraie estampille frappée fibre" },
  },
  {
    id: "stamp-jme",
    category: "stamps",
    title: { en: "The JME guild mark (jurande)", fr: "La marque de jurande JME" },
    body: { en: "On some Paris 18th-century pieces you may see a JME mark linked to the guild jury, sometimes near a maker's stamp. It is a positive period signal when genuine, but it is also forged. Read it with construction, not as a standalone certificate. If a seller leads with JME and blocks underside photos, slow down.", fr: "Sur certaines pièces parisiennes du XVIIIe on peut voir une marque JME liée à la jurande, parfois près d'une estampille de maker. C'est un signal d'époque positif si authentique, mais elle est aussi imitée. Lisez-la avec la construction, pas comme certificat isolé. Si un vendeur mène avec le JME et bloque les photos du dessous, ralentissez." },
    illustration: "jme_mark",
    pieceTags: [],
    periodTags: ["louis_xv", "louis_xvi", "transition"],
    makerRelated: true,
    keywords: { en: "JME jurande guild mark Paris", fr: "JME jurande marque Paris" },
  },
  {
    id: "stamp-fakes",
    category: "stamps",
    title: { en: "Fake and transplanted stamps", fr: "Estampilles fausses ou rapportées" },
    body: { en: "Stamps can be added to later furniture, or sections of stamped wood transplanted. Warning signs include a stamp on wood that does not match the carcase, a mark through fresh finish only, or a famous name on a piece whose construction is clearly later. If the price only makes sense with the name, verify before paying.", fr: "On peut ajouter une estampille à un meuble plus tardif, ou rapporter un fragment de bois estampillé. Signaux : marque sur un bois qui ne correspond pas à la caisse, marque seulement dans un vernis frais, ou grand nom sur une construction clairement plus tardive. Si le prix n'a de sens qu'avec le nom, vérifiez avant de payer." },
    illustration: "fake_stamp",
    pieceTags: [],
    periodTags: [],
    makerRelated: true,
    keywords: { en: "fake stamp transplanted forgery", fr: "fausse estampille rapportée" },
  },
  {
    id: "stamp-dealer-label",
    category: "stamps",
    title: { en: "A dealer label is not a stamp", fr: "Une étiquette de marchand n'est pas une estampille" },
    body: { en: "Paper labels, chalk inscriptions, and handwritten attributions are useful leads, not proof of maker. The app and a careful buyer treat 'stamped', 'attributed', and 'labelled' differently. Pay stamp premiums only for marks in the wood that you have seen—or for a written guarantee you accept.", fr: "Étiquettes papier, inscriptions à la craie et attributions manuscrites sont des pistes, pas la preuve du maker. L'application et un acheteur prudent distinguent « estampillé », « attribué » et « étiqueté ». Ne payez une prime d'estampille que pour des marques dans le bois que vous avez vues—ou une garantie écrite que vous acceptez." },
    illustration: "dealer_label",
    pieceTags: [],
    periodTags: [],
    makerRelated: true,
    keywords: { en: "dealer label attributed vs stamped", fr: "étiquette marchand attribué estampillé" },
  },
  {
    id: "stamp-invoice",
    category: "stamps",
    title: { en: "Invoice wording for stamped pieces", fr: "Libellé de facture pour pièces estampillées" },
    body: { en: "If you buy on the strength of a stamp, ask for clear invoice wording such as « estampillé P. Bellangé, époque Empire » (maker and period as claimed). Keep photos of the mark. Vague 'attributed to' language on an invoice that was sold as stamped is a mismatch to fix before money moves.", fr: "Si vous achetez sur la force d'une estampille, demandez un libellé clair du type « estampillé P. Bellangé, époque Empire » (maker et époque annoncés). Gardez des photos de la marque. Un vague « attribué à » sur une facture vendue comme estampillée est un écart à corriger avant le paiement." },
    illustration: "invoice",
    pieceTags: [],
    periodTags: [],
    makerRelated: true,
    keywords: { en: "invoice estampillé époque wording", fr: "facture estampillé époque libellé" },
  },
  {
    id: "buy-cash-cap",
    category: "buying",
    title: { en: "French cash cap for paying a professional", fr: "Plafond de paiement en espèces chez un professionnel" },
    body: { en: "In France, consumers paying a professional are limited in cash: €1,000 for French tax residents and €15,000 for non-residents (CMF art. D112-3; figures as commonly applied—confirm current thresholds if unsure). Above the cap, use card or transfer. Cash can still be a negotiating lever under the cap.", fr: "En France, le paiement en espèces d'un professionnel par un consommateur est plafonné : 1 000 € pour les résidents fiscaux français et 15 000 € pour les non-résidents (CMF art. D112-3 ; montants usuellement appliqués—vérifiez les seuils en vigueur en cas de doute). Au-delà, carte ou virement. Sous le plafond, les espèces restent un levier de négociation." },
    illustration: "cash_cap",
    pieceTags: [],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "cash cap D112-3 1000 15000", fr: "espèces plafond D112-3" },
  },
  {
    id: "buy-cash-vs-transfer",
    category: "buying",
    title: { en: "Cash vs instant transfer as a closing lever", fr: "Espèces vs virement immédiat comme levier" },
    body: { en: "Dealers often prefer a clean same-day sale. Under the cash cap, a cash offer can justify a discount. Above it, offer instant transfer or card and take the piece away the same day—the certainty still helps. Never pay large sums to a private unknown party without a receipt and identity checks that satisfy you.", fr: "Les marchands préfèrent souvent une vente nette le jour même. Sous le plafond espèces, une offre cash peut justifier une remise. Au-delà, proposez virement instantané ou carte et emportez la pièce le jour même—la certitude aide encore. Ne versez pas de grosses sommes à un particulier inconnu sans reçu et contrôles d'identité qui vous satisfont." },
    illustration: "payment",
    pieceTags: [],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "transfer cash negotiate same day", fr: "virement espèces négocier jour même" },
  },
  {
    id: "buy-premium",
    category: "buying",
    title: { en: "Buyer's premiums at auction (and TVA on fees)", fr: "Frais d'acheteur aux enchères (et TVA sur les frais)" },
    body: { en: "French and international rooms commonly add about 20–30% buyer's premium on the hammer, with VAT on the fees depending on the sale. Your real budget is all-in, not hammer. The app's walk-away figures are meant to be read that way for auction lots.", fr: "Les salles françaises et internationales ajoutent souvent environ 20–30 % de frais d'acheteur sur l'adjudication, avec TVA sur les frais selon la vente. Votre vrai budget est le « all-in », pas le marteau. Les prix de retrait de l'application se lisent ainsi pour les lots d'enchères." },
    illustration: "premium",
    pieceTags: [],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "buyer's premium TVA all-in hammer", fr: "frais acheteur TVA all-in adjudication" },
  },
  {
    id: "buy-condition",
    category: "buying",
    title: { en: "Condition reports and viewing", fr: "Rapports d'état et expositions" },
    body: { en: "At auction, read the condition report and still view in person when you can—reports miss things. Online-only lots need more conservative bids. Ask about restorations, woodworm treatment, and whether marble or glass is original. Silence in a report is not a warranty of perfection.", fr: "Aux enchères, lisez le rapport d'état et voyez sur place quand vous pouvez—les rapports passent à côté de détails. Les lots 100 % en ligne demandent des enchères plus prudentes. Demandez restaurations, traitement insectes, et si marbre ou glace sont d'origine. Le silence d'un rapport n'est pas une garantie de perfection." },
    illustration: "condition_report",
    pieceTags: [],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "condition report viewing woodworm", fr: "rapport d'état exposition vrillettes" },
  },
  {
    id: "buy-absentee",
    category: "buying",
    title: { en: "Absentee and phone bids", fr: "Ordres d'achat et enchères téléphoniques" },
    body: { en: "Absentee bids should include your true maximum all-in maths, not a hopeful hammer number. Phone bids help on contested lots but do not replace viewing. Leave clear written instructions with the room and keep confirmation emails. Auction fever is real—decide the walk-away before the sale opens.", fr: "Un ordre d'achat doit inclure votre maximum all-in réel, pas un marteau d'espoir. Le téléphone aide sur les lots disputés mais ne remplace pas la vue. Laissez des instructions écrites claires et gardez les e-mails de confirmation. La fièvre de salle est réelle—fixez le prix de retrait avant l'ouverture." },
    illustration: "absentee",
    pieceTags: [],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "absentee bid phone maximum", fr: "ordre d'achat téléphone maximum" },
  },
  {
    id: "buy-scam-listings",
    category: "buying",
    title: { en: "Red flags on classifieds and 'faire offre' ads", fr: "Signaux d'alerte sur petites annonces et « faire offre »" },
    body: { en: "Be cautious with €1 'faire offre' listings, stock photos reused across ads, wrong style names for the object shown, sellers refusing viewing, or pressure to pay outside the platform by gift card or unexplained transfer. Meet in a safe public place for private pickups; prefer established dealers for high-value pieces.", fr: "Méfiez-vous des annonces à 1 € « faire offre », des photos bancaires recyclées, des noms de style faux pour l'objet montré, des vendeurs qui refusent la vue, ou de la pression pour payer hors plateforme par carte cadeau ou virement opaque. Pour un particulier, lieu public sûr ; pour les fortes valeurs, privilégiez des marchands établis." },
    illustration: "scam",
    pieceTags: [],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "scam faire offre stock photo leboncoin", fr: "arnaque faire offre photo bancaire" },
  },
  {
    id: "buy-transport",
    category: "buying",
    title: { en: "Transport, packing, and insurance", fr: "Transport, emballage et assurance" },
    body: { en: "Mirrors, marble tops, and large cabinets need professional packing. Get a written quote that states insurance value and whether stairs or floor delivery are included. A 'bargain' that costs €800 to move may not be a bargain. Photograph condition at handover.", fr: "Miroirs, marbres et grandes armoires demandent un emballage pro. Obtenez un devis écrit avec valeur assurée et livraison étage ou non. Une « affaire » à 800 € de transport n'en est peut-être pas une. Photographiez l'état à la prise en charge." },
    illustration: "transport",
    pieceTags: [],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "shipping packing insurance marble", fr: "transport emballage assurance marbre" },
  },
  {
    id: "buy-negotiate",
    category: "buying",
    title: { en: "Negotiation: open below walk-away, use checklist answers", fr: "Négociation : ouvrez sous le prix de retrait, utilisez la checklist" },
    body: { en: "A solid approach is to open below your walk-away, keep room to move, and use concrete points (replaced glass, later mounts, missing stamp) rather than insulting the piece. The app's negotiation tips follow that logic and never suggest paying above its own walk-away.", fr: "Une approche solide : ouvrir sous votre prix de retrait, garder de la marge, et avancer des points concrets (glace remplacée, bronzes plus tardifs, estampille absente) plutôt que d'insulter la pièce. Les conseils de négociation de l'application suivent cette logique et ne suggèrent jamais de payer au-dessus de son propre prix de retrait." },
    illustration: "negotiate",
    pieceTags: [],
    periodTags: [],
    makerRelated: false,
    keywords: { en: "negotiate offer walk-away checklist", fr: "négocier offre prix de retrait" },
  },
];

export const fieldNoteById = (id: string): FieldNote | undefined => FIELD_NOTES.find(n => n.id === id);

