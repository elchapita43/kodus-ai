"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQueryState } from "nuqs";
import {
    BrainCircuit,
    ExternalLink,
    GitPullRequest,
    Search,
    Trash2,
    UserRound,
} from "lucide-react";

import { Badge } from "@components/ui/badge";
import { Button, buttonVariants } from "@components/ui/button";
import { Input } from "@components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@components/ui/select";
import { Spinner } from "@components/ui/spinner";
import {
    useDeleteLearning,
    useLearnings,
} from "@services/learnings/hooks";
import { Learning } from "@services/learnings";
import { cn } from "src/core/utils/components";

const KIND_LABELS: Record<string, string> = {
    convention: "Convención",
    decision: "Decisión",
    preference: "Preferencia",
    noise: "Ruido",
    attempted: "Intentado",
};

const SOURCE_LABELS: Record<string, string> = {
    pr: "PR",
    issue: "Issue",
    review: "Review",
    commit: "Commit",
    manual: "Manual",
    coderabbit: "CodeRabbit",
};

const sourceIcon = (sourceType: Learning["sourceType"]) => {
    switch (sourceType) {
        case "manual":
            return <UserRound className="size-3.5" />;
        default:
            return <GitPullRequest className="size-3.5" />;
    }
};

export function LearningsList() {
    const [q, setQ] = useQueryState("q");
    const [kind, setKind] = useQueryState("kind");
    const [status, setStatus] = useQueryState("status");
    const [searchInput, setSearchInput] = useState(q ?? "");

    const { data, isLoading } = useLearnings({
        q: q ?? undefined,
        kind: kind ?? undefined,
        status: status ?? undefined,
        limit: 50,
    });
    const deleteMutation = useDeleteLearning();

    const applySearch = () => {
        setQ(searchInput.trim() || null);
    };

    const items = useMemo(() => data?.items ?? [], [data]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-56 flex-1">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") applySearch();
                        }}
                        placeholder="Buscar learnings…"
                        className="pl-9"
                    />
                </div>
                <Select
                    value={kind ?? "all"}
                    onValueChange={(v) => setKind(v === "all" ? null : v)}
                >
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los tipos</SelectItem>
                        {Object.entries(KIND_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={status ?? "all"}
                    onValueChange={(v) => setStatus(v === "all" ? null : v)}
                >
                    <SelectTrigger className="w-40">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los estados</SelectItem>
                        <SelectItem value="active">Activos</SelectItem>
                        <SelectItem value="superseded">Superseded</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Spinner className="size-6" />
                </div>
            ) : items.length === 0 ? (
                <div className="text-muted-foreground border-muted flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-sm">
                    <BrainCircuit className="size-8 opacity-40" />
                    <span>Sin learnings todavía</span>
                    <span className="text-xs opacity-60">
                        Se generan automáticamente de las reviews de tus PRs, o
                        agregá uno manualmente.
                    </span>
                </div>
            ) : (
                <ul className="flex flex-col gap-2">
                    {items.map((learning) => (
                        <li
                            key={learning.id}
                            className={cn(
                                "border-muted hover:bg-muted/40 flex items-start gap-3 rounded-lg border p-3 transition-colors",
                                learning.status === "superseded" &&
                                    "opacity-50",
                            )}
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge size="xs" variant="primary-dark">
                                        {KIND_LABELS[learning.kind] ??
                                            learning.kind}
                                    </Badge>
                                    {learning.sourceType && (
                                        <Badge
                                            size="xs"
                                            variant="secondary"
                                            className="gap-1"
                                        >
                                            {sourceIcon(learning.sourceType)}
                                            {SOURCE_LABELS[
                                                learning.sourceType
                                            ] ?? learning.sourceType}
                                            {learning.sourceRef
                                                ? ` ${learning.sourceRef}`
                                                : ""}
                                        </Badge>
                                    )}
                                    <span className="text-muted-foreground text-xs">
                                        {new Date(
                                            learning.createdAt,
                                        ).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="mt-1.5 line-clamp-2 text-sm">
                                    {learning.content}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                                <Link
                                    href={`/learnings/${learning.id}`}
                                    aria-label="Ver detalle"
                                    className={cn(
                                        buttonVariants({
                                            variant: "helper",
                                            size: "icon-sm",
                                        }),
                                    )}
                                >
                                    <ExternalLink className="size-4" />
                                </Link>
                                <Button
                                    variant="error"
                                    size="icon-sm"
                                    aria-label="Eliminar"
                                    disabled={deleteMutation.isPending}
                                    onClick={() =>
                                        deleteMutation.mutate(learning.id)
                                    }
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
