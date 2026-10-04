import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  total,
  page,
  pageSize,
  onChange,
  unit,
}: {
  total: number;
  page: number;
  pageSize: number;
  onChange: (page: number) => void;
  unit: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="table-footer pagination">
      <span>
        共 {total} {unit}
      </span>
      {pages > 1 && (
        <nav aria-label="列表分页">
          <button
            type="button"
            className="icon-button"
            aria-label="上一页列表"
            disabled={page === 1}
            onClick={() => onChange(page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            {page} / {pages}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="下一页列表"
            disabled={page === pages}
            onClick={() => onChange(page + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
