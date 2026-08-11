# AGENTS.md

## Über mich
Ich bin Steven. Du bist der Agent. Wir werden viel zusammenarbeiten, also dachte ich, es lohnt sich, dass ich mich einmal vorstelle.

Ich habe vor einigen Jahren, bevor AI Teil der Web Entwicklung wurde, noch als Entwickler gearbeitet. Ca. 2022 habe ich aber aufgehört. Jetzt haben wir 2026 und ich bin wieder dabei. Ich habe in der Zeit viel über KI gelernt und habe 2025 auch ein kleines Web-Dev Projekt gehabt.

Ich baue gerne Projekte, die mir selbst im Alltag weiterhelfen. Ich habe sehr starkes ADHS und bin auch nicht grade dumm. Allerdings ist mein ADHS in vielen teilen Fluch und Segen zugleich, weswegen ich mir selbst versuche mit meinen Projekten weiter zu helfen.

Mir ist die Sicherheit der Daten und die Privatsphäre des Nutzers meiner Anwendungen extrem wichtig. Es darf nie passieren, dass Nutzerdaten von einer Drittperson abgefangen, gehackt oder sonst wie erlangt werden. Jedes Projekt von mir muss dagegen geschützt sein. Accessibility ist ebenfalls wichtig. Da möchte ich meinen Nutzern auch Optionen anbieten, ohne das Design der App zu zerstören. Bei diesen Themen herrscht maximaler Anspruch.

Ich bevorzuge einfache, gezielte Lösungen. Unnötige Komplexität muss unbedingt vermieden werden. Overengineering ist der Feind. Elegante Lösungen, die das gleiche erzielen und einfacher zu verstehen und zu warten sind, sind der Freund. Vermeide vorsorgliche Abstraktionen, unnötige Abhängigkeiten und Architektur für hypothetische Anforderungen.

## Glossar
- ich: Das bin ich, Steven.
- du: Das bist du, der gerade angesprochene Agent.
- wir: Ich und der Agent, der gerade mit mir an einer Aufgabe arbeitet.
- Nutzer: Menschen, die accura verwenden. Damit bin nicht automatisch nur ich gemeint.
- Task: Ein Issue im accura-Team in Linear, sofern aus dem Kontext nichts anderes hervorgeht.
- Doku: Die deutschsprachige Projektdokumentation im Repository.
- accura: Die Anwendung und das dazugehörige Projekt in diesem Repository.


## Coding Vorlieben - Allgemein
- Wir brauchen die Energie von "YAGNI" & "KISS".
- Typesafety ist wichtig und sollte ausgenutzt werden.
- Sei extrem vorstichtig mit destruktiven Commands, die nicht explizit vom Nutzer angewisen wurden.
- Kommentare an komplexeren Stellen im Code sind gut. Kommentiere nicht jede Zeile, aber fühle dich frei, da zu kommentieren, wo es wirklich sinn ergibt. Über Funktionsdeklarationen, Klassen, etc. Halte dich kurz aber einfach und verständlich.
- Halte deine Kommentare up to date.

## Coding Vorlieben - Typescript
- `any` ist der Feind. Inferred Types sind unser Freund.
- Wenn TS Code aussieht als hätte es ein Python Dev geschrieben, ist es schlechter TS Code.

## Fragen sind read-only
- Eine Frage bittet um eine Antwort, nicht um Änderungen. Wenn der Prompt mit "Wie schwer wäre es", "Was würde es benötigen", "Können wir XY", "Ist es möglich", oder ähnlichem beginnt und etwas fragt, dann antworte darauf und editiere keine Dateien.
- Wenn die Antwort offensichtlich und die Änderung trivial ist, antworte dennoch zuerst und biete dann die Lösung an. Frage, bevor du die Lösung baust.

## Zusammenarbeit mit mir

* Kommuniziere direkt, klar und ohne unnötige Vorrede.
* Wenn eine technische oder architektonische Entscheidung größere Folgen hat, erkläre mir verständlich den Grund, die relevanten Alternativen und die Auswirkungen. Triff solche Entscheidungen nicht stillschweigend für mich.
* Ich gebe die Richtung für Produkt und UX vor. Weise mich trotzdem klar darauf hin, wenn eine Idee technische, finanzielle oder sicherheitsrelevante Probleme verursachen könnte.
* Sicherheit, Privatsphäre und Accessibility haben bei meinen Projekten einen sehr hohen Stellenwert. Behandle sie nicht als optionalen Feinschliff.

## Über das Projekt: accura

Ich baue accura, weil ich selbst Schwierigkeiten damit habe, meine Finanzen vollständig zu überblicken. Die App soll nicht möglichst viele Dinge mit Geld machen. Sie soll Menschen dabei helfen, ihre finanzielle Situation klar zu verstehen und bessere Entscheidungen zu treffen, ohne sie dabei zusätzlich zu überfordern.

accura richtet sich besonders an Menschen, die beim Thema Finanzen Angst, Unsicherheit oder Überforderung erleben. Die App muss ihnen warm, ruhig und respektvoll begegnen. Nutzer dürfen niemals beschämt, moralisiert oder bevormundet werden.

Einfache Erklärungen bedeuten nicht, dass der Nutzer weniger intelligent ist. Vereinfache deshalb die Darstellung, aber niemals die Wahrheit. Zeige die wichtigsten Informationen zuerst und vermeide unnötige Funktionen, Ablenkung und Gamification.

Finanzielle Aussagen müssen korrekt, nachvollziehbar und erklärbar sein. Wenn ein Ergebnis von Annahmen, möglicherweise veralteten Daten oder Unsicherheiten abhängt, muss das erkennbar sein. Täusche keine Genauigkeit vor, die technisch oder fachlich nicht existiert.

Finanzdaten sind hochsensibel. Verhindere unnötige Speicherung, zu breite Berechtigungen, Datenlecks und sensible Inhalte in Logs, Analytics oder Telemetrie.

accura soll ein fokussiertes Finanz-Cockpit bleiben. Erweitere die App nicht beiläufig zu einem universellen All-in-one-Finanzprodukt.

Google Material 3 Expressive ist die visuelle Referenz. Nutze ausdrucksstarke Formen, Farben und Bewegung mit klarer Hierarchie. Die App soll trotzdem ruhig, zugänglich und einfach zu bedienen bleiben.

Prüfe jede relevante Änderung besonders auf finanzielle Korrektheit, Datenschutz, Sicherheit, Accessibility und geringe kognitive Belastung.

