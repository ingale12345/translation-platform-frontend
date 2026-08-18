/**
 * Comments are always read alongside the translation cell they belong to, so their hooks
 * live with the grid. Re-exported here so the feature folder is discoverable.
 */
export {
  translationCommentQueries,
  translationCommentKeys,
  useTranslationCommentsQuery,
  useCreateTranslationComment,
  useUpdateTranslationComment,
  useRemoveTranslationComment,
  useCellComments,
} from "@/features/translations/hooks"
