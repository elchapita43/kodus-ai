"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { Button } from "@components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@components/ui/dialog";
import { Input } from "@components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@components/ui/select";
import { Textarea } from "@components/ui/textarea";
import { getRepositories } from "@services/codeManagement/fetch";
import { useCreateLearning } from "@services/learnings/hooks";
import { useSelectedTeamId } from "src/core/providers/selected-team-context";

export function CreateLearningButton() {
    const [open, setOpen] = useState(false);
    const [content, setContent] = useState("");
    const [sourceRef, setSourceRef] = useState("");
    const [repositoryId, setRepositoryId] = useState<string>("");
    const { teamId } = useSelectedTeamId();

    const { data: repositories = [] } = useQuery({
        queryKey: ["repositories", teamId],
        queryFn: () => getRepositories(teamId!),
        enabled: !!teamId && open,
    });

    const createMutation = useCreateLearning();

    const submit = () => {
        if (!content.trim() || !repositoryId) return;
        createMutation.mutate(
            {
                repositoryId,
                content: content.trim(),
                sourceRef: sourceRef.trim() || null,
            },
            {
                onSuccess: () => {
                    setOpen(false);
                    setContent("");
                    setSourceRef("");
                    setRepositoryId("");
                },
            },
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="primary" size="md">
                    <Plus className="size-4" />
                    Nuevo learning
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Nuevo learning</DialogTitle>
                    <DialogDescription>
                        Anotá una convención, decisión o preferencia del
                        proyecto.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                    <Select
                        value={repositoryId}
                        onValueChange={setRepositoryId}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Proyecto" />
                        </SelectTrigger>
                        <SelectContent>
                            {repositories.map((repo: any) => (
                                <SelectItem key={repo.id} value={repo.id}>
                                    {repo.fullName ?? repo.name ?? repo.id}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Ej: nunca commitear .env con secrets reales"
                        rows={3}
                    />
                    <Input
                        value={sourceRef}
                        onChange={(e) => setSourceRef(e.target.value)}
                        placeholder="Origen (opcional): #1140"
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="primary"
                        size="md"
                        onClick={submit}
                        disabled={
                            !content.trim() || !repositoryId || createMutation.isPending
                        }
                    >
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
