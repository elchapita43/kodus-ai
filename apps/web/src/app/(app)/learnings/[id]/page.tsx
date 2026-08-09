"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BrainCircuit, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@components/ui/badge";
import { Button, buttonVariants } from "@components/ui/button";
import { Page } from "@components/ui/page";
import { Spinner } from "@components/ui/spinner";
import { Textarea } from "@components/ui/textarea";
import { getLearning } from "@services/learnings";
import {
    useDeleteLearning,
    useSupersedeLearning,
} from "@services/learnings/hooks";
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

export default function LearningDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [refineOpen, setRefineOpen] = useState(false);
    const [newContent, setNewContent] = useState("");

    const { data: learning, isLoading } = useQuery({
        queryKey: ["learning", id],
        queryFn: () => getLearning(id),
    });

    const supersedeMutation = useSupersedeLearning();
    const deleteMutation = useDeleteLearning();

    if (isLoading) {
        return (
            <Page.Root>
                <Page.Content>
                    <div className="flex justify-center py-16">
                        <Spinner className="size-6" />
                    </div>
                </Page.Content>
            </Page.Root>
        );
    }

    if (!learning) {
        return (
            <Page.Root>
                <Page.Content>
                    <p className="text-muted-foreground">Learning no encontrado</p>
                </Page.Content>
            </Page.Root>
        );
    }

    const originLabel = learning.sourceRef
        ? `${SOURCE_LABELS[learning.sourceType] ?? learning.sourceType} ${learning.sourceRef}`
        : SOURCE_LABELS[learning.sourceType] ?? learning.sourceType;

    return (
        <Page.Root>
            <Page.Content>
                <div className="flex flex-col gap-4">
                    <Link
                        href="/learnings"
                        className={cn(
                            buttonVariants({ variant: "helper", size: "sm" }),
                            "w-fit",
                        )}
                    >
                        <ArrowLeft className="size-4" />
                        Volver
                    </Link>

                    <div className="flex flex-wrap items-center gap-2">
                        <Badge size="xs" variant="primary-dark">
                            {KIND_LABELS[learning.kind] ?? learning.kind}
                        </Badge>
                        <Badge size="xs" variant="secondary">
                            {originLabel}
                        </Badge>
                        <Badge
                            size="xs"
                            variant={
                                learning.status === "active"
                                    ? "success"
                                    : "secondary"
                            }
                        >
                            {learning.status === "active" ? "Activo" : "Superseded"}
                        </Badge>
                        {learning.sourceUrl && (
                            <Link
                                href={learning.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(
                                    buttonVariants({
                                        variant: "helper",
                                        size: "sm",
                                    }),
                                )}
                            >
                                <ExternalLink className="size-4" />
                                Ver origen
                            </Link>
                        )}
                    </div>

                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                        <BrainCircuit className="size-3.5" />
                        Creado el{" "}
                        {new Date(learning.createdAt).toLocaleString()}
                        {learning.createdBy === "system"
                            ? " · autogenerado"
                            : " · manual"}
                        {learning.supersedesId && (
                            <span> · refina #{learning.supersedesId.slice(0, 8)}</span>
                        )}
                    </div>

                    <p className="text-base leading-relaxed">{learning.content}</p>

                    {learning.status === "active" && (
                        <div className="mt-2 flex flex-col gap-2">
                            {refineOpen ? (
                                <div className="flex flex-col gap-2">
                                    <Textarea
                                        value={newContent}
                                        onChange={(e) =>
                                            setNewContent(e.target.value)
                                        }
                                        placeholder="Versión refinada del learning…"
                                        rows={3}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            disabled={
                                                !newContent.trim() ||
                                                supersedeMutation.isPending
                                            }
                                            onClick={() =>
                                                supersedeMutation.mutate(
                                                    {
                                                        id: learning.id,
                                                        newContent:
                                                            newContent.trim(),
                                                    },
                                                    {
                                                        onSuccess: () =>
                                                            setRefineOpen(false),
                                                    },
                                                )
                                            }
                                        >
                                            Refinar
                                        </Button>
                                        <Button
                                            variant="helper"
                                            size="sm"
                                            onClick={() => setRefineOpen(false)}
                                        >
                                            Cancelar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setRefineOpen(true)}
                                    >
                                        <Pencil className="size-4" />
                                        Refinar
                                    </Button>
                                    <Button
                                        variant="error"
                                        size="sm"
                                        disabled={deleteMutation.isPending}
                                        onClick={() => deleteMutation.mutate(learning.id)}
                                    >
                                        <Trash2 className="size-4" />
                                        Eliminar
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Page.Content>
        </Page.Root>
    );
}
