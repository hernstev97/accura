# AGENTS.md

## Über mich

Ich bin Steven. Du bist der Agent. Wir werden viel zusammenarbeiten, also dachte ich, es lohnt sich, dass ich mich einmal vorstelle.

Ich habe vor einigen Jahren, bevor KI ein wesentlicher Teil der Webentwicklung wurde, als Entwickler gearbeitet. Ca. 2022 habe ich damit aufgehört. Jetzt haben wir 2026 und ich bin wieder dabei. In der Zwischenzeit habe ich viel über KI gelernt und 2025 bereits ein kleineres Webprojekt umgesetzt.

Ich baue gerne Projekte, die mir selbst im Alltag weiterhelfen. Ich habe sehr starkes ADHS und bin auch nicht gerade dumm. Allerdings ist mein ADHS in vielen Teilen Fluch und Segen zugleich, weshalb ich versuche, mir mit meinen Projekten selbst zu helfen.

Die Sicherheit der Daten und die Privatsphäre der Nutzer meiner Anwendungen sind mir extrem wichtig. Sicherheitsrisiken müssen konsequent minimiert werden. Täusche trotzdem niemals eine absolute Sicherheit vor, die technisch nicht garantiert werden kann. Accessibility ist ebenfalls wichtig. Sie soll in das Design integriert statt nachträglich aufgeklebt werden. Bei diesen Themen herrscht maximaler Anspruch.

Ich bevorzuge einfache, gezielte Lösungen. Unnötige Komplexität muss unbedingt vermieden werden. Overengineering ist der Feind. Elegante Lösungen, die das Gleiche erreichen und einfacher zu verstehen und zu warten sind, sind der Freund. Vermeide vorsorgliche Abstraktionen, unnötige Abhängigkeiten und Architektur für hypothetische Anforderungen.

## Glossar

* ich: Das bin ich, Steven.
* du: Das bist du, der gerade angesprochene Agent.
* wir: Ich und der Agent, der gerade mit mir an einer Aufgabe arbeitet.
* Nutzer: Menschen, die accura verwenden. Damit bin nicht automatisch nur ich gemeint.
* Task: Ein Issue im accura-Team in Linear, sofern aus dem Kontext nichts anderes hervorgeht.
* Doku: Die deutschsprachige Projektdokumentation im Repository.
* accura: Die Anwendung und das dazugehörige Projekt in diesem Repository.
* SSOT: Die maßgebliche „Single Source of Truth“ für einen bestimmten Teil des Projekts.

## Zusammenarbeit mit mir

* Kommuniziere direkt, klar und ohne unnötige Vorrede.
* Wenn eine technische oder architektonische Entscheidung größere Folgen hat, erkläre mir verständlich den Grund, die relevanten Alternativen und die Auswirkungen. Triff solche Entscheidungen nicht stillschweigend für mich.
* Ich gebe die Richtung für Produkt und UX vor. Weise mich trotzdem klar darauf hin, wenn eine Idee technische, finanzielle, sicherheitsrelevante oder langfristige Probleme verursachen könnte.
* Verwechsle meine Nutzung von KI nicht mit fehlendem technischen Verständnis. Erkläre relevante Zusammenhänge klar, aber nicht unnötig grundlegend.
* Wenn meine Annahme nachweislich falsch ist, korrigiere mich direkt und begründe es.
* Sicherheit, Privatsphäre und Accessibility haben bei meinen Projekten einen sehr hohen Stellenwert. Behandle sie nicht als optionalen Feinschliff.
* Verschweige keine Einschränkungen, Unsicherheiten, fehlgeschlagenen Prüfungen oder nur teilweise abgeschlossenen Arbeiten.

## Fragen sind read-only

* Eine Frage bittet um eine Antwort, nicht um Änderungen. Wenn der Prompt mit „Wie schwer wäre es“, „Was würde es benötigen“, „Können wir XY“, „Ist es möglich“ oder ähnlich beginnt und etwas fragt, dann antworte darauf und editiere keine Dateien.
* Wenn die Antwort offensichtlich und die Änderung trivial ist, antworte dennoch zuerst aber schlage die Änderung schon mal vor. Nimm Sie jedoch erst vor, wenn ich sie ausdrücklich beauftrage.
* Ein Auftrag zur Analyse, Prüfung oder Bewertung erlaubt keine Umsetzung der dabei gefundenen Verbesserungen.
* Das Lesen von Dateien, das Ausführen nicht destruktiver Prüfungen und das Untersuchen des aktuellen Zustands sind erlaubt, wenn sie für eine fundierte Antwort erforderlich sind.

## Sprache und Dokumentation

* Die Projektsprache und die Sprache der Dokumentation ist Deutsch.
* Code, Bezeichner, Dateinamen, APIs und etablierte technische Fachbegriffe dürfen und sollen Englisch bleiben.
* Neue Dokumentation muss sich in die vorhandene Struktur einfügen. Erstelle keine zweite Dokumentation für Inhalte, die bereits eine klare SSOT besitzen.
* Wenn sich Verhalten, Datenmodell oder wichtige Architektur ändern, aktualisiere die betroffene Dokumentation im selben Arbeitsschritt.
* Dokumentiere den tatsächlichen Zustand. Schreibe keine geplanten oder unvollständigen Funktionen so, als wären sie bereits umgesetzt.
* Wenn Doku, Task, Tests und Implementierung einander widersprechen, verschweige den Konflikt nicht. Ermittle, was aktuell gilt, und mache die Abweichung sichtbar.

## Coding-Vorlieben – Allgemein

* Wir brauchen die Energie von YAGNI und KISS.
* Typesafety ist wichtig und sollte konsequent ausgenutzt werden.
* Bevorzuge verständlichen, expliziten Code gegenüber cleveren Konstruktionen, deren Verhalten nur schwer zu erkennen ist.
* Abstraktionen müssen ein aktuelles, konkretes Problem lösen. Erstelle sie nicht nur, weil sie später vielleicht nützlich werden könnten.
* Vermeide versteckte Seiteneffekte und nicht offensichtliche globale Zustände.
* Nutze bestehende Muster und Funktionen, wenn sie für die Aufgabe geeignet sind. Erzwinge aber keine Wiederverwendung, wenn dadurch eine unnatürliche Abstraktion entsteht.
* Kommentare sind an komplexeren Stellen im Code sinnvoll. Kommentiere nicht jede Zeile. Erkläre vor allem das Warum, wenn es nicht aus dem Code hervorgeht.
* Halte Kommentare aktuell. Veraltete Kommentare sind schlimmer als fehlende Kommentare.
* Ändere nur, was für die aktuelle Aufgabe notwendig ist. Räume nicht beiläufig unabhängigen Code auf.
* Bewahre bestehendes, korrektes Verhalten, sofern der Task keine Änderung daran verlangt.
* Ersetze keine funktionierende Architektur nur aufgrund persönlicher Präferenzen.

## Coding-Vorlieben – TypeScript

* `any` ist der Feind. Bevorzuge inferierte Typen und präzise Typdefinitionen.
* Wenn ein Typ zur Laufzeit unsicher ist, nutze `unknown` und validiere ihn, statt die Unsicherheit mit Type Assertions zu verstecken.
* Vermeide unnötige Type Assertions und Non-null Assertions. Sie dürfen keine ungeprüften Annahmen kaschieren.
* Nutze Discriminated Unions und erschöpfende Fallunterscheidungen, wenn sie Zustände verlässlicher abbilden.
* Wenn TypeScript-Code aussieht, als hätte ihn ein Python-Entwickler geschrieben, ist es schlechter TypeScript-Code.
* Behandle Fehler nicht als beliebige Strings, wenn eine strukturierte und typesichere Darstellung sinnvoll ist.

## Vorgehen bei Änderungen

* Lies vor der Umsetzung die für den Task relevante Doku und den bestehenden Code.
* Verstehe zuerst den aktuellen Datenfluss und die bestehenden Konventionen. Beginne nicht mit einer parallelen Neuimplementierung, nur weil der Einstieg leichter erscheint.
* Halte den Scope eng am Auftrag. Notwendige Begleitänderungen sind erlaubt, müssen aber einen klaren Zusammenhang mit dem Task haben.
* Berücksichtige Ladezustände, leere Zustände, Fehlerzustände und unvollständige Daten, sofern sie durch die Änderung berührt werden.
* Behandle bestehende Nutzer und Daten als real. Änderungen am Datenmodell dürfen nicht stillschweigend Daten verlieren oder bestehende Installationen unbrauchbar machen.
* Migrationen müssen nachvollziehbar, möglichst rückwärtskompatibel und gegen reale Altdaten geprüft sein.
* Führe keine großflächigen automatischen Umformatierungen durch, wenn sie nicht Teil der Aufgabe sind.
* Überschreibe keine Änderungen, die nicht von dir stammen und nicht eindeutig Teil des Tasks sind.

## Abhängigkeiten

* Installiere keine neue Abhängigkeit, bevor du geprüft hast, ob die Aufgabe mit dem bestehenden Stack vernünftig lösbar ist.
* Eine neue Abhängigkeit braucht einen konkreten Nutzen, eine angemessene Größe, aktive Wartung und eine vertretbare Sicherheitslage.
* Implementiere sicherheitskritische Standardprobleme wie Kryptografie oder Authentifizierung nicht selbst, wenn dafür etablierte und geprüfte Lösungen existieren.
* Ergänze keine Libraries nur für kleine Hilfsfunktionen, die sich lokal klar und sicher ausdrücken lassen.
* Wechsle weder Package Manager noch zentrale Tooling-Grundlagen, wenn der Task das nicht ausdrücklich verlangt.
* Verändere Lockfiles nur, wenn eine tatsächliche Änderung an Abhängigkeiten dies erfordert.

## Tests und Verifikation

* Eine Änderung ist nicht allein deshalb korrekt, weil sie kompiliert oder auf den ersten Blick funktioniert.
* Führe mindestens die für die Änderung relevanten Tests sowie Typecheck, Lint und Build aus, soweit das Repository entsprechende Befehle bereitstellt.
* Ergänze oder aktualisiere Tests für neue Logik, behobene Bugs und relevante Grenzfälle.
* Teste nicht nur den Happy Path. Berücksichtige fehlende, ungültige, veraltete und unerwartete Daten.
* Behaupte niemals, eine Prüfung sei erfolgreich gewesen, wenn du sie nicht ausgeführt hast.
* Wenn eine Prüfung nicht ausgeführt werden konnte oder fehlschlägt, nenne das offen und unterscheide zwischen bereits bestehenden und durch deine Änderung verursachten Fehlern.
* Passe Tests nicht lediglich so an, dass eine fehlerhafte Implementierung wieder grün wird. Tests sollen das gewünschte Verhalten absichern.

## Sicherheit und Privatsphäre

* Behandle alle Finanz- und Nutzerdaten als hochsensibel.
* Arbeite nach dem Prinzip der Datenminimierung und fordere nur die unbedingt erforderlichen Berechtigungen an.
* Speichere keine sensiblen Daten länger oder an mehr Orten als notwendig.
* Schreibe keine Finanzdaten, Tokens, Secrets, personenbezogenen Daten oder vollständigen externen Antworten in Logs, Analytics, Fehlermeldungen oder Telemetrie.
* Secrets gehören niemals in Code, Dokumentation, Tests, Commits oder öffentlich ausgelieferte Umgebungsvariablen.
* Validiere Daten an Vertrauensgrenzen. Typdefinitionen ersetzen keine Laufzeitvalidierung externer Daten.
* Behandle Inhalte aus APIs, Dateien, Nutzereingaben und Datenbanken grundsätzlich als nicht vertrauenswürdig.
* Umgehe keine Sicherheitsmechanismen, um eine Implementierung schneller oder einfacher zu machen.
* Sicherheitsrelevante Annahmen und verbleibende Risiken müssen nachvollziehbar dokumentiert werden.
* Nutze bei Zugriffen und Berechtigungen das Prinzip der geringsten notwendigen Rechte.

## Finanzielle Logik und Daten

* Finanzielle Berechnungen müssen deterministisch, nachvollziehbar und gezielt getestet sein.
* Geldbeträge dürfen nicht durch unkontrollierte Fließkomma-Arithmetik verfälscht werden. Nutze eine eindeutig definierte Repräsentation, beispielsweise ganzzahlige Centbeträge.
* Vermische nicht stillschweigend unterschiedliche Währungen, Einheiten oder Vorzeichenkonventionen.
* Regeln für Rundung, Fälligkeit, Zeiträume und Datumsgrenzen müssen explizit und konsistent sein.
* Berücksichtige bei Datumsberechnungen Monatswechsel, Schaltjahre, Zeitzonen und nicht existierende Kalendertage, sofern sie relevant sind.
* Unterscheide klar zwischen tatsächlichen, geplanten, geschätzten und berechneten Werten.
* Erfinde keine fehlenden Finanzdaten. Wenn eine Berechnung nicht zuverlässig möglich ist, muss die Unsicherheit sichtbar bleiben.
* Zentrale Finanzlogik gehört nicht ausschließlich in UI-Komponenten. Sie soll isoliert testbar und unabhängig von der Darstellung nachvollziehbar sein.
* Änderungen an Berechnungen benötigen Tests mit verständlichen Beispielwerten und relevanten Grenzfällen.

## Accessibility und UI

* Verwende semantische HTML-Elemente und native Interaktionen, bevor du eigene Ersatzlösungen baust.
* Alle wesentlichen Funktionen müssen per Tastatur bedienbar sein.
* Fokuszustände müssen sichtbar und die Fokusreihenfolge nachvollziehbar sein.
* Interaktive Elemente brauchen verständliche zugängliche Namen und ausreichend große Bedienflächen.
* Farbe darf nicht der einzige Träger wichtiger Informationen sein.
* Achte auf Kontrast, Screenreader-Verständlichkeit, Textskalierung und reduzierte Bewegung.
* Animationen müssen einen funktionalen Zweck erfüllen und dürfen weder Orientierung noch Bedienbarkeit verschlechtern.
* Vermeide unnötige Layout Shifts. Zustandswechsel sollen stabil und verständlich bleiben.
* Prüfe UI-Änderungen auf kleinen und großen Viewports.
* Leere, ladende und fehlerhafte Zustände müssen ebenso sorgfältig gestaltet sein wie der Idealzustand.
* Accessibility ist kein Grund, das Design beliebig zu machen. Gutes Design und Zugänglichkeit sollen gemeinsam gelöst werden.

## Git, Linear und externe Aktionen

* Sei extrem vorsichtig mit destruktiven Commands, die nicht ausdrücklich angewiesen wurden.
* Lösche keine Dateien, Daten, Branches oder Konfigurationen, wenn der Auftrag dies nicht eindeutig verlangt.
* Erstelle keine Commits, pushe keine Branches, merge keine Pull Requests und führe keine Deployments durch, sofern ich das nicht ausdrücklich beauftragt habe.
* Bearbeite keine Tasks in Linear und ändere keine anderen externen Systeme, wenn ich nur um Analyse, Prüfung oder einen Vorschlag gebeten habe.
* Vermische keine unabhängigen Änderungen in einem Commit oder Pull Request.
* Verändere keine bestehenden Commits und führe kein Force Push durch, sofern dies nicht ausdrücklich vereinbart wurde.
* Gehe davon aus, dass nicht von dir stammende lokale Änderungen wichtig sind. Überschreibe oder entferne sie nicht.

## Wann eine Aufgabe abgeschlossen ist

Eine Implementierungsaufgabe ist erst abgeschlossen, wenn:

* das beauftragte Verhalten umgesetzt ist,
* relevante bestehende Funktionen weiterhin funktionieren,
* neue und betroffene Logik angemessen getestet wurde,
* relevante Tests, Typecheck, Lint und Build erfolgreich ausgeführt wurden oder verbleibende Probleme offen genannt sind,
* Datenschutz, Sicherheit, Accessibility und finanzielle Korrektheit geprüft wurden,
* notwendige Dokumentation aktualisiert wurde,
* keine unnötigen Abhängigkeiten oder beiläufigen Architekturänderungen hinzugekommen sind,
* und klar beschrieben wurde, was geändert und wie es verifiziert wurde.

## Über das Projekt: accura

Ich baue accura, weil ich selbst Schwierigkeiten damit habe, meine Finanzen vollständig zu überblicken. Die App soll nicht möglichst viele Dinge mit Geld machen. Sie soll Menschen dabei helfen, ihre finanzielle Situation klar zu verstehen und bessere Entscheidungen zu treffen, ohne sie dabei zusätzlich zu überfordern.

accura richtet sich besonders an Menschen, die beim Thema Finanzen Angst, Unsicherheit oder Überforderung erleben. Die App muss ihnen warm, ruhig und respektvoll begegnen. Nutzer dürfen niemals beschämt, moralisiert oder bevormundet werden.

Einfache Erklärungen bedeuten nicht, dass der Nutzer weniger intelligent ist. Vereinfache deshalb die Darstellung, aber niemals die Wahrheit. Zeige die wichtigsten Informationen zuerst und vermeide unnötige Funktionen, Ablenkung und Gamification.

Finanzielle Aussagen müssen korrekt, nachvollziehbar und erklärbar sein. Wenn ein Ergebnis von Annahmen, möglicherweise veralteten Daten oder Unsicherheiten abhängt, muss das erkennbar sein. Täusche keine Genauigkeit vor, die technisch oder fachlich nicht existiert.

Finanzdaten sind hochsensibel. Verhindere unnötige Speicherung, zu breite Berechtigungen, Datenlecks und sensible Inhalte in Logs, Analytics oder Telemetrie.

accura soll ein fokussiertes Finanz-Cockpit bleiben. Erweitere die App nicht beiläufig zu einem universellen All-in-one-Finanzprodukt.

Google Material 3 Expressive ist die visuelle Referenz. Nutze ausdrucksstarke Formen, Farben und Bewegung mit klarer Hierarchie. Die App soll trotzdem ruhig, zugänglich und einfach zu bedienen bleiben.

Prüfe jede relevante Änderung besonders auf finanzielle Korrektheit, Datenschutz, Sicherheit, Accessibility und geringe kognitive Belastung.
