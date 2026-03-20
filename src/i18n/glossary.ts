/**
 * Specialist glossary for antique terminology, styles, materials, and furniture types.
 * This ensures consistent and accurate terminology across different languages.
 */
export const antiqueGlossary = {
  en: {
    styles: ["Chippendale", "Hepplewhite", "Sheraton", "Queen Anne", "Art Deco", "Art Nouveau", "Mid-Century Modern", "Victorian", "Georgian", "Empire", "Biedermeier", "Regency"],
    materials: ["Mahogany", "Oak", "Walnut", "Rosewood", "Satinwood", "Ormolu", "Parian", "Jasperware", "Sterling Silver", "Tortoiseshell", "Giltwood", "Brass", "Bronze", "Marble", "Porcelain"],
    furnitureTypes: ["Bureau", "Chiffonier", "Davenport", "Pembroke Table", "Whatnot", "Girandole", "Credenza", "Bergère", "Fauteuil", "Commode", "Console", "Armoire"],
    terminology: ["Dovetail joints", "Patina", "Provenance", "Repoussé", "Inlay", "Marquetry", "Parquetry", "Vernis Martin", "Japanning", "Maker's Stamp", "Signature", "Attributed to", "Workshop of", "Original Finish", "Marriage"]
  },
  fr: {
    styles: ["Louis XIV", "Louis XV", "Louis XVI", "Directoire", "Empire", "Restauration", "Art Déco", "Art Nouveau", "Régence", "Chippendale", "Hepplewhite", "Sheraton", "Biedermeier"],
    materials: ["Acajou", "Chêne", "Noyer", "Palissandre", "Bois de rose", "Bronze doré", "Parian", "Grès cérame", "Argent massif", "Écaille de tortue", "Bois doré", "Laiton", "Marbre", "Porcelaine"],
    furnitureTypes: ["Bureau plat", "Chiffonnier", "Bonheur du jour", "Table à gibier", "Semainier", "Girandole", "Commode", "Bergère", "Fauteuil", "Console", "Armoire", "Davenport", "Crédence"],
    terminology: ["Queue d'aronde", "Patine", "Provenance", "Repoussé", "Incrustation", "Marqueterie", "Parqueterie", "Vernis Martin", "Laque", "Estampille", "Signature", "Attribué à", "Atelier de", "Finition d'origine", "Mariage"]
  },
  es: {
    styles: ["Isabelino", "Alfonsino", "Art Déco", "Art Nouveau", "Renacimiento Español", "Barroco", "Luis XV", "Luis XVI", "Imperio", "Regencia", "Chippendale", "Hepplewhite", "Sheraton", "Biedermeier"],
    materials: ["Caoba", "Roble", "Nogal", "Palisandro", "Madera de rosa", "Bronce dorado", "Plata de ley", "Carey", "Madera dorada", "Latón", "Mármol", "Porcelana"],
    furnitureTypes: ["Buró", "Sinfonier", "Consola", "Girandole", "Cómoda", "Butaca", "Sillón", "Escritorio", "Armario", "Davenport", "Aparador"],
    terminology: ["Cola de milano", "Pátina", "Procedencia", "Repujado", "Incrustación", "Marquetería", "Parquetería", "Barniz", "Sello del fabricante", "Firma", "Atribuido a", "Taller de", "Acabado original", "Matrimonio"]
  },
  de: {
    styles: ["Biedermeier", "Gründerzeit", "Jugendstil", "Art Déco", "Barock", "Rokoko", "Louis XV", "Louis XVI", "Empire", "Regency", "Chippendale", "Hepplewhite", "Sheraton"],
    materials: ["Mahagoni", "Eiche", "Walnuss", "Rosenholz", "Feinsilber", "Schildpatt", "Feuervergoldung", "Vergoldetes Holz", "Messing", "Bronze", "Marmor", "Porzellan"],
    furnitureTypes: ["Sekretär", "Vertiko", "Anrichte", "Girandole", "Kommode", "Sessel", "Chiffonnière", "Guéridon", "Schreibtisch", "Fauteuil", "Bergère", "Konsole", "Schrank", "Davenport", "Kredenz"],
    terminology: ["Schwalbenschwanzverbindung", "Patina", "Provenienz", "Ziselierung", "Intarsie", "Marketerie", "Parketerie", "Lackierung", "Herstellerstempel", "Signatur", "Zugeschrieben", "Werkstatt von", "Originalzustand", "Zusammenstellung"]
  }
};

export const getGlossaryPrompt = (lang: string) => {
  const glossary = (antiqueGlossary as any)[lang] || antiqueGlossary.en;
  return `
    Use the following specialist glossary for accurate terminology in ${lang}:
    - Styles: ${glossary.styles.join(', ')}
    - Materials: ${glossary.materials.join(', ')}
    - Furniture Types: ${glossary.furnitureTypes.join(', ')}
    - Terminology: ${glossary.terminology.join(', ')}
  `;
};
