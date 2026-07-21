Priorité haute
Fiche match trop chargée — trop de boutons orga (recrutement, stats, clôturer, annuler, composition…). Une CTA principale selon la phase + un menu « Plus » éviterait les mauvaises actions.
Stats collaboratives trop lourdes pour 80 % des matchs — le parcours complet est excellent en théorie, mais dimanche soir personne ne veut valider buts + notes + MVP. « Clôturer sans stats » devrait être le chemin simple par défaut ; les stats détaillées en option « mode pro ».
Pas de rappels J-0 / H-2 — le vrai frein amateur, c’est les désistements de dernière minute. Les notifs « match créé » ne remplacent pas ça.
Orga fantôme — si l’orga disparaît, le match reste bloqué. Il faudrait un co-orga, un rappel, ou une auto-proposition d’annuler/clôturer après N jours.
Priorité moyenne
Statut live mort — documenté / en base, pas vraiment dans l’UI. À brancher (verrouille présences) ou à abandonner clairement.
Prix affiché seulement — un simple « payé / pas payé » serait plus utile que beaucoup de features sociales.
Liste d’attente = course au clic — pas une vraie file. OK pour du pickup, frustrant pour des réguliers.
Timezone naïve — date/heure sans fuseau : risque de mauvais « à venir » vs « à finaliser ».
Technique
Docs / schema.sql en retard sur les migrations (pending_stats, completed_without_stats).
Deep link / store — si le match est déjà en cache, pas de refresh systématique → UI parfois désynchronisée.
Ce qui est déjà bien
Cycle de vie clair, guests, waitlist, amis, composition, RPCs côté serveur, realtime, et les correctifs récents (matchs qui ne disparaissent plus + annuler / clôturer). Base solide pour un MVP amis.

En une phrase : l’app est forte sur l’orga de match ; le prochain levier, c’est moins de friction post-match et plus de fiabilité humaine (rappels, orga absent, UI orga simplifiée) — pas plus de features vitrine.