/**
 * Prolog: Text in allen Sprachen des Spiels. Absätze aus Zeilen; jede Zeile wird zur passenden Zeit eingeblendet.
 * Die Aufnahmen (ElevenLabs, Stimme „Brian“) erzeugt tools/prolog_sprechen.ts nach apps/web/public/prolog/.
 */
export type ProlSprache = 'de' | 'en' | 'fr' | 'es';
export const PROLOG: Record<ProlSprache, { lang: string[][]; kurz: string[][] }> = {
  de: {
    lang: [
      ['Es gab eine Zeit, da war die Welt still.', 'Wälder ohne Ende. Berge, die den Himmel trugen.', 'Und tief unter allem schliefen die Runen. Uralt. Voller Kraft.'],
      ['Dann kam die Nacht, in der die Erde aufriss.'],
      ['Aus den Rissen kroch die Wildnis.', 'Moorwichte im Nebel. Trolle aus lebendem Stein.', 'Schatten mit Augen wie Glut.', 'Sie kamen mit der Dunkelheit. Und sie kamen wieder. Jede Nacht.'],
      ['Die Völker flohen. Nur wenige blieben.', 'Die Glutborn aus dem Feuerberg. Die Hainmar, Hüter des Waldes. Die Sturmweber der Höhen.', 'Sie hatten keine Armeen. Keine Helden.', 'Sie hatten etwas Besseres:', 'Einfälle.'],
      ['Am Tag fällten sie Holz und brachen Stein.', 'Sie bauten Mauern, Türme, Leuchtfeuer.', 'Und aus dem, was die Wesen zurückließen, erschufen sie Neues:', 'Feuer, das nicht erlischt. Uhrwerke, die niemals ruhen. Licht aus reinem Kristall.'],
      ['Vierzig Nächte.', 'Vierzig Nächte, bis die Risse versiegelt sind …', 'oder die letzte Feste fällt.'],
      ['Die Sonne sinkt.', 'Entzünde die Fackeln.', 'Halte die Feste.']
    ],
    kurz: [['Die Risse sind offen. Die Wildnis erwacht.', 'Bei Tag baust du. Bei Nacht hältst du stand.'], ['Vierzig Nächte. Eine Feste.', 'Halte sie.']]
  },
  en: {
    lang: [
      ['There was a time when the world was silent.', 'Endless forests. Mountains that carried the sky.', 'And deep beneath it all, the runes lay sleeping. Ancient. Full of power.'],
      ['Then came the night the earth tore open.'],
      ['Out of the rifts crawled the wild.', 'Bog imps in the mist. Trolls of living stone.', 'Shadows with eyes like embers.', 'They came with the darkness. And they came again. Every night.'],
      ['The peoples fled. Only a few remained.', 'The Glutborn from the fire mountain. The Hainmar, keepers of the forest. The Sturmweber of the heights.', 'They had no armies. No heroes.', 'They had something better:', 'Ideas.'],
      ['By day they felled timber and broke stone.', 'They built walls, towers, beacons.', 'And from what the creatures left behind, they made something new:', 'Fire that never dies. Clockwork that never rests. Light of pure crystal.'],
      ['Forty nights.', 'Forty nights until the rifts are sealed …', 'or the last fortress falls.'],
      ['The sun is setting.', 'Light the torches.', 'Hold the fortress.']
    ],
    kurz: [['The rifts are open. The wild awakens.', 'By day you build. By night you stand firm.'], ['Forty nights. One fortress.', 'Hold it.']]
  },
  fr: {
    lang: [
      ['Il fut un temps où le monde était silencieux.', 'Des forêts sans fin. Des montagnes qui portaient le ciel.', 'Et tout au fond, sous la terre, dormaient les runes. Anciennes. Pleines de puissance.'],
      ['Puis vint la nuit où la terre se déchira.'],
      ['Des failles surgit la nature sauvage.', 'Des diablotins dans la brume. Des trolls de pierre vivante.', 'Des ombres aux yeux de braise.', 'Ils vinrent avec les ténèbres. Et ils revinrent. Chaque nuit.'],
      ['Les peuples s’enfuirent. Seuls quelques-uns restèrent.', 'Les Glutborn de la montagne de feu. Les Hainmar, gardiens de la forêt. Les Sturmweber des hauteurs.', 'Ils n’avaient ni armées. Ni héros.', 'Ils avaient mieux que cela :', 'des idées.'],
      ['Le jour, ils abattaient le bois et taillaient la pierre.', 'Ils bâtirent des murs, des tours, des feux-phares.', 'Et de ce que les créatures laissaient derrière elles, ils firent du neuf :', 'un feu qui ne s’éteint jamais. Des rouages qui ne s’arrêtent jamais. Une lumière de cristal pur.'],
      ['Quarante nuits.', 'Quarante nuits, jusqu’à ce que les failles soient scellées …', 'ou que la dernière forteresse tombe.'],
      ['Le soleil se couche.', 'Allume les torches.', 'Tiens la forteresse.']
    ],
    kurz: [['Les failles sont ouvertes. La nature sauvage s’éveille.', 'Le jour, tu bâtis. La nuit, tu tiens bon.'], ['Quarante nuits. Une forteresse.', 'Tiens-la.']]
  },
  es: {
    lang: [
      ['Hubo un tiempo en que el mundo estaba en silencio.', 'Bosques sin fin. Montañas que sostenían el cielo.', 'Y en lo más hondo dormían las runas. Antiguas. Llenas de poder.'],
      ['Entonces llegó la noche en que la tierra se abrió.'],
      ['De las grietas surgió lo salvaje.', 'Diablillos en la niebla. Troles de piedra viva.', 'Sombras con ojos como brasas.', 'Llegaron con la oscuridad. Y volvieron. Cada noche.'],
      ['Los pueblos huyeron. Solo unos pocos se quedaron.', 'Los Glutborn de la montaña de fuego. Los Hainmar, guardianes del bosque. Los Sturmweber de las alturas.', 'No tenían ejércitos. Ni héroes.', 'Tenían algo mejor:', 'ideas.'],
      ['De día talaban madera y partían piedra.', 'Construyeron murallas, torres, fanales.', 'Y con lo que dejaban las criaturas crearon algo nuevo:', 'fuego que nunca se apaga. Engranajes que nunca descansan. Luz de cristal puro.'],
      ['Cuarenta noches.', 'Cuarenta noches hasta sellar las grietas …', 'o hasta que caiga la última fortaleza.'],
      ['El sol se pone.', 'Enciende las antorchas.', 'Defiende la fortaleza.']
    ],
    kurz: [['Las grietas están abiertas. Lo salvaje despierta.', 'De día construyes. De noche resistes.'], ['Cuarenta noches. Una fortaleza.', 'Defiéndela.']]
  }
};
/** Zeiten je Zeile in Sekunden (von tools/prolog_sprechen.ts geschrieben, liegt neben den Aufnahmen) */
export interface ProlZeiten { dauer: number; zeilen: [number, number][][] }
