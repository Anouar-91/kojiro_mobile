Priorité haute
~~Fiche match trop chargée~~ — fait : CTA principale par phase + menu « Plus »
Stats collaboratives trop lourdes pour 80 % des matchs — partiellement adressé (clôturer = CTA post-match ; saisie détaillée dans Plus)
~~Pas de rappels J-0 / H-2~~ — fait : cron SQL `058` (présent + maybe, Europe/Paris)
Orga fantôme — prochain
Priorité moyenne
Statut live mort — documenté / en base, pas vraiment dans l’UI. À brancher (verrouille présences) ou à abandonner clairement.
Prix affiché seulement — un simple « payé / pas payé » serait plus utile que beaucoup de features sociales.
Liste d’attente = course au clic — pas une vraie file. OK pour du pickup, frustrant pour des réguliers.
Timezone naïve — date/heure sans fuseau : risque de mauvais « à venir » vs « à finaliser ». (rappels utilisent Europe/Paris)
Technique
Docs / schema.sql en retard sur les migrations (pending_stats, completed_without_stats).
Deep link / store — si le match est déjà en cache, pas de refresh systématique → UI parfois désynchronisée.