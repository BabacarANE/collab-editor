-- La colonne searchVector existait mais n'était jamais alimentée : la
-- recherche ne renvoyait aucun résultat. Elle est désormais calculée par
-- trigger (titre pondéré A, contenu sans balises pondéré B) et indexée.

CREATE OR REPLACE FUNCTION document_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('french', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('french', regexp_replace(coalesce(NEW.content, ''), '<[^>]+>', ' ', 'g')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS document_search_vector_trigger ON "Document";
CREATE TRIGGER document_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, content ON "Document"
  FOR EACH ROW EXECUTE FUNCTION document_search_vector_update();

-- Alimente les documents existants (déclenche le trigger)
UPDATE "Document" SET title = title;

CREATE INDEX IF NOT EXISTS "Document_searchVector_idx" ON "Document" USING GIN ("searchVector");
