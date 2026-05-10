import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface LoadMoreButtonProps {
  onClick: () => void
  loading: boolean
  hasMore: boolean
  currentCount: number
  totalCount: number
  disabled?: boolean
}

export function LoadMoreButton({
  onClick,
  loading,
  hasMore,
  currentCount,
  totalCount,
  disabled = false,
}: LoadMoreButtonProps) {
  if (!hasMore) {
    return null
  }

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <Button
        onClick={onClick}
        disabled={loading || disabled}
        variant="outline"
        className="w-full gap-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? "Loading..." : `Load More (${currentCount} of ${totalCount})`}
      </Button>
      {!loading && hasMore && (
        <p className="text-xs text-gray-500">
          Showing {currentCount} of {totalCount} items
        </p>
      )}
    </div>
  )
}

interface PaginationInfoProps {
  currentCount: number
  totalCount: number
  pageSize: number
}

export function PaginationInfo({
  currentCount,
  totalCount,
  pageSize,
}: PaginationInfoProps) {
  const pagesLoaded = Math.ceil(currentCount / pageSize)
  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="py-2 text-center text-sm text-gray-600">
      <p>
        Showing {currentCount} of {totalCount} items ({pagesLoaded} of {totalPages} pages)
      </p>
    </div>
  )
}
