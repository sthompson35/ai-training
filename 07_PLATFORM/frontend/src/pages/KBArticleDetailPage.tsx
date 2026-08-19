import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  KBArticle,
  KBArticleInput,
  createKBArticle,
  deleteKBArticle,
  getKBArticle,
  updateKBArticle,
} from "../lib/api";
import { KBArticleForm } from "../components/KBArticleForm";
import { useToast, UNDO_WINDOW_MS } from "../components/ToastProvider";

export function KBArticleDetailPage(): React.ReactElement {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = articleId === undefined;
  const [article, setArticle] = useState<KBArticle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    getKBArticle(Number(articleId))
      .then(setArticle)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load article"));
  }, [articleId, isNew]);

  async function handleSubmit(payload: KBArticleInput): Promise<void> {
    try {
      if (isNew) {
        const created = await createKBArticle(payload);
        toast.success("Article created.");
        navigate(`/knowledge-base/${created.id}`);
      } else {
        await updateKBArticle(Number(articleId), payload);
        setArticle(await getKBArticle(Number(articleId)));
        toast.success("Article updated.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save article");
    }
  }

  function handleDelete(): void {
    if (!article || !window.confirm(`Delete article "${article.title}"?`)) return;
    const { id, title } = article;
    navigate("/knowledge-base");
    const timeoutId = setTimeout(async () => {
      try {
        await deleteKBArticle(id);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete article");
      }
    }, UNDO_WINDOW_MS);
    toast.success(`"${title}" deleted.`, { label: "Undo", onClick: () => clearTimeout(timeoutId) });
  }

  if (error) return <p role="alert">{error}</p>;
  if (!isNew && !article) return <p>Loading article…</p>;

  return (
    <>
      <p>
        <Link to="/knowledge-base">&larr; All articles</Link>
      </p>
      <h1>{isNew ? "New Article" : article!.title}</h1>
      <KBArticleForm
        initialValues={article ?? undefined}
        submitLabel={isNew ? "Create article" : "Save changes"}
        onSubmit={handleSubmit}
      />
      {!isNew && (
        <button onClick={handleDelete} style={{ marginTop: 16 }}>
          Delete article
        </button>
      )}
    </>
  );
}
