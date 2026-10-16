// Explications courtes de chaque statistique, affichées dans la saisie athlète
// (Espace athlète → Compétitions → « Mes stats ») via une icône « i ».
//
// But : une joueuse ou un joueur doit comprendre quoi saisir sans demander au
// staff. Les textes restent volontairement brefs (une à deux phrases).

import { getBaseSport, type StatField } from "@/lib/constants/sportStats";

type DescMap = Record<string, string>;

/** Explications communes à plusieurs sports. */
const SHARED: DescMap = {
  minutesPlayed:
    "Nombre de minutes passées sur le terrain pendant le match, arrêts de jeu compris.",
  playingTime:
    "Nombre de minutes passées sur le terrain pendant le match, arrêts de jeu compris.",
  effectivePlayingTime:
    "Temps de jeu effectif : les minutes réelles de jeu, arrêts de jeu et pauses déduits.",
  longestSequence:
    "La plus longue séquence de jeu enchaînée sans interruption, en minutes.",
  averageSequence:
    "La durée moyenne de tes séquences de jeu, en minutes.",
  starts:
    "Mets 1 si tu as commencé le match comme titulaire, 0 si tu es entrée en cours de jeu.",
  manOfMatch:
    "Mets 1 si tu as été désignée meilleure joueuse du match, 0 sinon.",
  yellowCards: "Nombre de cartons jaunes reçus pendant le match.",
  redCards: "Nombre de cartons rouges reçus pendant le match.",
  fouls: "Nombre de fautes sifflées contre toi pendant le match.",
  foulsCommitted: "Fautes que tu as commises sur une adversaire.",
  foulsWon: "Fautes que l'adversaire a commises sur toi (fautes subies).",
  assists:
    "Passes décisives : une passe ou un contrôle qui amène directement un point marqué par une coéquipière.",
  turnoversLost:
    "Ballons perdus : chaque fois que tu perds le ballon et que l'adversaire en profite immédiatement.",
  interceptions:
    "Ballons adverses que tu coupes ou captes avant qu'ils n'arrivent à leur destinataire.",
  steals:
    "Ballons adverses que tu prends directement à l'adversaire (interceptions, ballons grattés).",
  blocks:
    "Actions où tu bloques le tir ou l'attaque adverse de tes mains ou de ton corps.",
  touches: "Nombre de fois où tu as joué le ballon pendant le match.",
  totalDistance:
    "Distance totale parcourue pendant le match, en mètres (relevée par le GPS).",
  sprintCount:
    "Nombre de courses à très haute intensité effectuées pendant le match.",
  sprintDistance:
    "Distance totale parcourue en sprint, en mètres (relevée par le GPS).",
  topSpeed:
    "Ta vitesse la plus élevée enregistrée pendant le match, en km/h.",
};

/** Explications propres à un sport : elles passent avant les textes communs. */
const SPORT_DESC: Record<string, DescMap> = {
  rugby: {
    tries: "Essais que tu as marqués toi-même. Un essai vaut 5 points.",
    tryAssists:
      "Passes décisives qui amènent directement un essai marqué par une coéquipière.",
    conversionsMade:
      "Transformations que tu as réussies après un essai (coup de pied entre les poteaux).",
    conversionsMissed: "Transformations que tu as tentées et manquées.",
    conversionAttempts: "Nombre total de transformations tentées.",
    conversions:
      "Transformations réussies : valeur calculée automatiquement à partir de tes saisies.",
    penaltiesMade: "Pénalités que tu as passées entre les poteaux.",
    penaltiesMissed: "Pénalités que tu as tentées et manquées.",
    penaltyAttempts: "Nombre total de pénalités tentées.",
    penaltiesScored:
      "Pénalités marquées : valeur calculée automatiquement à partir de tes saisies.",
    dropsMade: "Drops réussis (coup de pied après rebond, en jeu ouvert).",
    dropsMissed: "Drops tentés et manqués.",
    dropAttempts: "Nombre total de drops tentés.",
    dropGoals:
      "Drops marqués : valeur calculée automatiquement à partir de tes saisies.",
    points:
      "Points marqués : calculés automatiquement à partir de tes essais, transformations, pénalités et drops. Tu n'as rien à saisir.",
    scrumsWon: "Mêlées gagnées par ton équipe grâce à ton action (lancer, poussée).",
    scrumsLost: "Mêlées perdues par ton équipe sur une action où tu étais impliquée.",
    lineoutsWon: "Touche gagnée par ton équipe sur un lancer que tu as effectué ou subi.",
    lineoutsLost: "Touche perdue par ton équipe sur une action où tu étais impliquée.",
    mauls: "Ballons portés (mauls) auxquels tu as participé.",
    rucks: "Rucks (regroupements au sol) auxquels tu as participé.",
    lineBreaks: "Franchissements : tu passes la ligne défensive adverse balle en main.",
    cleanBreaks:
      "Percées nettes : franchissements sans contact, sans être touchée par une adversaire.",
    breakthroughs:
      "Franchissements : valeur calculée automatiquement à partir de tes saisies.",
    passesMade: "Passes que tu as données et qui sont bien arrivées à une partenaire.",
    passesMissed: "Passes que tu as données et qui ont été perdues ou interceptées.",
    kicksMade: "Coups de pied réussis (au pied, main ou botté) qui restent dans le terrain.",
    kicksMissed: "Coups de pied manqués : sortis en touche ou hors terrain.",
    knockOns: "En-avants : tu as fait avancer le ballon volontairement avec la main ou le bras.",
    carries: "Nombre de fois où tu as couru avec le ballon (porteurs de balle).",
    metersGained:
      "Mètres gagnés en courant balle en main, calculés automatiquement.",
    postContactMeters:
      "Mètres parcourus balle en main après un contact avec une adversaire.",
    totalContacts:
      "Contacts totaux : valeur calculée automatiquement à partir de tes saisies.",
    offloads:
      "Passes données après un contact, sans être allée au sol (offloads).",
    tackles:
      "Plaquages réussis : tu stoppes l'adversaire au sol. Ne compte pas les plaquages manqués.",
    tacklesMissed:
      "Plaquages manqués : tu as tenté de plaquer mais l'adversaire a passé.",
    tackleSuccess:
      "Pourcentage de plaquages réussis, calculé automatiquement.",
    jackalWins: "Ballons grattés au sol sur une adversaire plaquée.",
    turnoversWon: "Ballons récupérés sur l'adversaire (grattages, interceptions).",
    defensiveRecoveries:
      "Ballons récupérés en défense : valeur calculée automatiquement.",
    penaltiesConceded: "Pénalités concédées par toi (fautes qui donnent une pénalité à l'adversaire).",
    defenseCollisions:
      "Collisions défensives : valeur calculée automatiquement à partir de tes saisies.",
    totalCollisions:
      "Collisions totales : valeur calculée automatiquement à partir de tes saisies.",
    collisionsOver5m:
      "Collisions avec élan (plus de 5 mètres avant le contact) : valeur calculée automatiquement.",
    collisionsUnder5m:
      "Collisions quasi statiques (moins de 5 mètres d'élan) : valeur calculée automatiquement.",
  },
  football: {
    goals: "Buts que tu as marqués toi-même.",
    penaltyGoals: "Buts marqués sur penalty.",
    headedGoals: "Buts marqués de la tête.",
    shotsOnTarget: "Tirs qui vont dans le cadre (attrapés par la gardienne ou qui font but).",
    shotsOffTarget: "Tirs qui passent à côté ou au-dessus du cadre.",
    shotsBlocked: "Tirs contrés par une adversaire avant d'atteindre le cadre.",
    bigChances: "Grosses occasions de but que tu as eues (occasion nette de marquer).",
    bigChancesMissed: "Grosses occasions que tu n'as pas converties en but.",
    xG:
      "Expected Goals : la probabilité moyenne de marquer sur tes occasions, calculée par le modèle du club. Tu n'as rien à saisir.",
    passes: "Passes réussies : tes passes qui arrivent à une partenaire.",
    passesAttempted: "Passes tentées : total de passes jouées, réussies ou non.",
    passAccuracy: "Pourcentage de passes réussies, calculé automatiquement.",
    longBalls: "Longs ballons (au-delà de 32 m) qui arrivent à une partenaire.",
    throughBalls: "Passes en profondeur qui cassent la ligne défensive adverse.",
    keyPasses:
      "Passes clés : passes qui créent une occasion de but sans être une passe décisive.",
    duelsWon: "Duels gagnés : un contre un remporté face à une adversaire.",
    aerialDuelsWon: "Duels aériens gagnés : ballons hauts remportés de la tête.",
    dribbles: "Dribbles réussis : tu élimines une adversaire balle au pied.",
    dribblesAttempted: "Dribbles tentés, réussis ou non.",
    crosses: "Centres : ballons adressés depuis les ailes vers la surface.",
    crossesAccurate: "Centres qui arrivent à une partenaire.",
    possessionWon: "Ballons récupérés sur l'adversaire.",
    possessionLost: "Ballons perdus alors que tu le possédais.",
    tackles: "Tacles tentés pour reprendre le ballon à une adversaire.",
    tacklesWon: "Tacles réussis : le ballon est repris sans faire de faute.",
    clearances: "Dégagements : tu éloignes le ballon de ta zone de danger.",
    blockedShots: "Tirs adverses que tu bloques de ton corps.",
    offsidesCaught: "Hors-jeux que tu fais lever en remontant la ligne défensive.",
    errorsLeadingToGoal: "Erreurs de ta part qui amènent directement un but adverse.",
    ownGoals: "Buts que tu as marqués contre ton propre camp.",
    // Gardienne
    saves: "Ballons adverses détournés ou captés alors qu'ils allaient au but.",
    savePercentage: "Pourcentage d'arrêts réussis, calculé automatiquement.",
    goalsAgainst: "Buts encaissés pendant que tu étais sur le terrain.",
    cleanSheets: "Matchs sans encaisser de but (1 si c'est ton cas).",
    penaltiesSaved: "Pénaltys détournés ou captés.",
    highClaims: "Sorties aériennes où tu captes le ballon dans les airs.",
    punches: "Ballons que tu repousses du poing.",
    throwouts: "Relances à la main.",
    goalKicks: "Relances au pied (six mètres).",
  },
  handball: {
    goals: "Buts que tu as marqués toi-même.",
    shots: "Tirs tentés vers le but, qu'ils soient marqués ou non.",
    shootingPercentage: "Pourcentage de réussite au tir, calculé automatiquement.",
    goalsFromWing: "Buts marqués en position d'ailier.",
    goalsFromPivot: "Buts marqués en position de pivot.",
    goalsFromBackcourt: "Buts marqués en position d'arrière.",
    goalsFromFastBreak: "Buts marqués en contre-attaque.",
    sevenMeters: "Jets de 7 mètres réussis.",
    sevenMetersAttempted: "Jets de 7 mètres tentés.",
    sevenMetersWon: "Jets de 7 mètres que tu as obtenus pour ton équipe.",
    sevenMetersSaved: "Jets de 7 mètres adverses détournés.",
    fastBreakSaves: "Arrêts réalisés en contre-attaque adverse.",
    passes: "Passes que tu as données à une partenaire.",
    technicalFaults: "Fautes techniques : perte de balle, marcher, passe en-out.",
    twoMinutes: "Exclusions de 2 minutes que tu as reçues.",
    steals: "Ballons adverses que tu interceptes.",
    blocks: "Tirs adverses que tu contres.",
    blockedShots: "Tirs adverses que tu bloques (gardienne).",
    forcedTurnovers: "Pertes de balle que tu provoques chez l'adversaire.",
  },
  volleyball: {
    setsPlayed: "Nombre de sets auxquels tu as participé.",
    points: "Points marqués pour ton équipe grâce à ton action.",
    kills: "Attaques gagnantes : ton ballon tombe dans le camp adverse ou est mal joué.",
    aces: "Services qui tombent directement dans le camp adverse sans être touchés.",
    acePercentage: "Pourcentage d'aces sur tes services, calculé automatiquement.",
    attackErrors: "Attaques que tu as envoyées hors terrain ou dans le filet.",
    attackAttempts: "Nombre total d'attaques que tu as tentées.",
    attackPercentage: "Pourcentage d'attaque, calculé automatiquement.",
    killPercentage: "Pourcentage de kills sur tes tentatives, calculé automatiquement.",
    sets: "Passes (sets) que tu as données à une attaquante.",
    setAssists: "Passes décisives qui amènent un point.",
    setErrors: "Passes qui ont directement causé la perte du point.",
    serviceErrors: "Services manqués : hors terrain ou dans le filet.",
    serviceAttempts: "Services tentés au total.",
    serviceAcePercentage: "Pourcentage d'aces sur tes services, calculé automatiquement.",
    blocks: "Contres : tu touches le ballon au-dessus du filet et tu bloques l'attaque.",
    blockSolos: "Contres gagnants réalisés seule.",
    blockAssists: "Contres gagnants réalisés à deux ou trois.",
    blockErrors: "Contres fautes : ballon touché dans le filet ou hors terrain.",
    digs: "Réceptions défensives : tu sauves une attaque adverse.",
    digErrors: "Réceptions défensives manquées.",
    receptionErrors: "Réceptions de service manquées.",
    receptionAttempts: "Réceptions de service tentées.",
    receptionPercentage: "Pourcentage de réceptions réussies, calculé automatiquement.",
    perfectReceptions: "Réceptions parfaites : le ballon arrive idéalement à la passeuse.",
    jumpCount: "Nombre total de sauts réalisés pendant le match.",
    attackJumps: "Sauts réalisés pour attaquer.",
    blockJumps: "Sauts réalisés pour contrer.",
  },
  basketball: {
    points: "Points inscrits par toi pendant le match.",
    fieldGoalsMade: "Paniers marqués, à 2 et à 3 points.",
    fieldGoalsAttempted: "Paniers tentés, marqués ou manqués.",
    fieldGoalPercentage: "Pourcentage de réussite aux tirs, calculé automatiquement.",
    threePointersMade: "Paniers à 3 points marqués.",
    threePointersAttempted: "Paniers à 3 points tentés.",
    threePointPercentage: "Pourcentage de réussite à 3 points, calculé automatiquement.",
    twoPointersMade: "Paniers à 2 points marqués.",
    twoPointersAttempted: "Paniers à 2 points tentés.",
    freeThrowsMade: "Lancers francs réussis.",
    freeThrowsAttempted: "Lancers francs tentés.",
    freeThrowPercentage: "Pourcentage de réussite aux lancers francs, calculé automatiquement.",
    pointsInPaint: "Points marqués dans la raquette (zone peinte).",
    fastBreakPoints: "Points marqués en contre-attaque.",
    secondChancePoints: "Points marqués après un rebond offensif.",
    personalFouls: "Fautes personnelles sifflées contre toi.",
    technicalFouls: "Fautes techniques sifflées contre toi.",
    plusMinus:
      "Écart de score pendant que tu étais sur le terrain : positif si ton équipe a marqué plus que l'adversaire.",
    efficiency:
      "Efficacité (EFF) : score composite calculé automatiquement à partir de tes statistiques.",
    offensiveRebounds: "Rebonds pris après un tir raté de ton équipe.",
    defensiveRebounds: "Rebonds pris après un tir raté de l'adversaire.",
    totalRebounds: "Rebonds totaux : offensifs + défensifs, calculés automatiquement.",
    turnovers: "Ballons perdus : passes interceptées, marches, possessions perdues.",
    assistTurnoverRatio: "Ratio passes décisives / ballons perdus, calculé automatiquement.",
    screenAssists: "Passes décisives données juste après un écran que tu as posé.",
    blocksAgainst: "Tirs que tu as tentés et qui ont été contrés par l'adversaire.",
    deflections: "Ballons adverses que tu dévies sans les capter.",
    chargesTaken: "Fautes offensives adverses que tu as provoquées en restant en place.",
  },
  basketball_3x3: {
    matchDurationSeconds: "Durée totale du match en secondes (10 min maximum ou jusqu'à 21 points).",
    points: "Points inscrits par toi (1 point intérieur arc, 2 points derrière l'arc, 1 point par lancer franc).",
    onePointersMade: "Tirs à 1 point réussis : tirs pris à l'intérieur de l'arc.",
    onePointersAttempted: "Tirs à 1 point tentés.",
    onePointPercentage: "Pourcentage de réussite sur les tirs à 1 point, calculé automatiquement.",
    twoPointersMade: "Tirs à 2 points réussis : tirs pris derrière l'arc.",
    twoPointersAttempted: "Tirs à 2 points tentés.",
    twoPointPercentage: "Pourcentage de réussite sur les tirs à 2 points, calculé automatiquement.",
    freeThrowsMade: "Lancers francs réussis (1 point chacun).",
    freeThrowsAttempted: "Lancers francs tentés.",
    freeThrowPercentage: "Pourcentage de réussite aux lancers francs, calculé automatiquement.",
    vps: "VPS : valeur pondérée officielle FIBA 3x3, calculée automatiquement par la fédération.",
    foulsDrawn: "Fautes que tu as provoquées chez l'adversaire.",
    drives: "Pénétrations : courses balle en main vers le panier.",
    shotsAfterCheck: "Tirs pris après un check-ball validé.",
    offensiveReboundsAfterClear: "Rebonds offensifs suivis d'une sortie d'arc puis d'un tir.",
    checkBallsWon: "Check-balls gagnés : tu récupères le ballon à la remise en jeu.",
    checkBallsLost: "Check-balls perdus : l'adversaire récupère le ballon.",
  },
};

function labelFor(key: string, allStats?: StatField[]): string {
  const found = allStats?.find((s) => s.key === key);
  return found?.label ?? key;
}

/**
 * Clé du dictionnaire de descriptions pour un sport. getBaseSport écrase les
 * variantes (basketball_3x3 -> basketball), donc on traite ici les règles
 * réellement distinctes.
 */
function sportMapKey(sportType?: string): string {
  if (!sportType) return "";
  const raw = String(sportType).toLowerCase();
  if (raw === "basketball_3x3") return "basketball_3x3";
  return getBaseSport(raw);
}

/** Description affichée dans l'infobulle d'une statistique. */
export function getStatDescription(
  stat: StatField,
  sportType?: string,
  allStats?: StatField[],
): string {
  // 1. Pourcentages automatiques : on explique la formule plutôt qu'un mot vague.
  if (stat.computedFrom) {
    const { successKey, totalKey, failureKey } = stat.computedFrom;
    const success = labelFor(successKey, allStats);
    const total = totalKey
      ? labelFor(totalKey, allStats)
      : `${labelFor(successKey, allStats)} + ${labelFor(failureKey!, allStats)}`;
    return `Calculé automatiquement : ${success} sur ${total}. Tu n'as rien à saisir ici.`;
  }

  const sportDesc = SPORT_DESC[sportMapKey(sportType)]?.[stat.key];
  if (sportDesc) return sportDesc;

  const shared = SHARED[stat.key];
  if (shared) return shared;

  // 2. Statistique non saisissable (dérivée, ou tenue par le staff).
  if (stat.enterable === false) {
    return "Statistique calculée automatiquement à partir de tes autres saisies — tu n'as pas besoin de la remplir.";
  }

  // 3. Statistique personnalisée ajoutée par le club : on reste explicite.
  if (stat.type === "percentage") {
    return `Pourcentage « ${stat.label} » : indique le nombre de fois sur 100 où cette action a réussi.`;
  }
  return `Saisis le nombre de « ${stat.label} » réalisés pendant le match.`;
}
