import React, { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Sparkles,
  FileDown,
  Trash2,
  Plus,
  Loader2,
  FlaskConical,
  ClipboardList,
  Bot,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { MODULES } from "@/config/modules";
import {
  listSamples,
  createSample,
  deleteSample,
  analyzeSample,
} from "@/lib/api";
import { exportSamplePdf } from "@/lib/pdf";

const emptyForm = (module) => ({
  sample_code: "",
  sample_name: "",
  product_type: "",
  operator: "",
  test_date: "",
  rating: "",
  notes: "",
  parameters: Object.fromEntries(module.parameters.map((p) => [p.key, ""])),
});

const inputCls =
  "bg-zinc-950 border-zinc-800 focus-visible:border-amber-500/50 focus-visible:ring-1 focus-visible:ring-amber-500/50 text-sm";

export default function ModulePage() {
  const { module: slug } = useParams();
  const isValid = Boolean(MODULES[slug]);
  const module = MODULES[slug] || Object.values(MODULES)[0];
  const qc = useQueryClient();

  const [form, setForm] = useState(() => emptyForm(module));
  const [viewSample, setViewSample] = useState(null);

  // reset form when module changes
  const [activeSlug, setActiveSlug] = useState(slug);
  if (activeSlug !== slug) {
    setActiveSlug(slug);
    setForm(emptyForm(module));
    setViewSample(null);
  }

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ["samples", slug],
    queryFn: () => listSamples(slug),
  });

  const createMut = useMutation({
    mutationFn: (payload) => createSample(slug, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["samples", slug] });
      setForm(emptyForm(module));
      toast.success("Sampel berhasil disimpan");
    },
    onError: () => toast.error("Gagal menyimpan sampel"),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => deleteSample(slug, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["samples", slug] });
      toast.success("Sampel dihapus");
    },
  });

  const analyzeMut = useMutation({
    mutationFn: (id) => analyzeSample(slug, id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["samples", slug] });
      setViewSample(data);
      toast.success("Analisa AI selesai");
    },
    onError: () => toast.error("Analisa AI gagal"),
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.sample_code.trim() || !form.sample_name.trim()) {
      toast.error("Kode & Nama Sampel wajib diisi");
      return;
    }
    createMut.mutate(form);
  };

  const setParam = (key, value) =>
    setForm((f) => ({ ...f, parameters: { ...f.parameters, [key]: value } }));

  if (!isValid) {
    return <Navigate to="/" replace />;
  }

  return (
    <div data-testid={`module-page-${slug}`} className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-500">
            <FlaskConical className="h-3.5 w-3.5" />
            Laboratory Module
          </div>
          <h1 className="font-heading mt-2 text-3xl font-bold tracking-tight text-zinc-50 lg:text-4xl">
            {module.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">{module.description}</p>
        </div>
        <Badge className="w-fit border border-zinc-700 bg-zinc-900 text-zinc-300">
          {samples.length} sampel tersimpan
        </Badge>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-5">
        {/* Input form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-2"
        >
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="mb-5 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-amber-500" />
              <h2 className="font-heading text-base font-semibold text-zinc-100">
                Input Data Sampel
              </h2>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kode Sampel *">
                  <Input
                    data-testid="input-sample-code"
                    className={inputCls}
                    value={form.sample_code}
                    onChange={(e) => setForm({ ...form, sample_code: e.target.value })}
                    placeholder="SMP-001"
                  />
                </Field>
                <Field label="Nama Sampel *">
                  <Input
                    data-testid="input-sample-name"
                    className={inputCls}
                    value={form.sample_name}
                    onChange={(e) => setForm({ ...form, sample_name: e.target.value })}
                    placeholder="Crude Oil A"
                  />
                </Field>
                <Field label="Jenis Produk">
                  <Input
                    data-testid="input-product-type"
                    className={inputCls}
                    value={form.product_type}
                    onChange={(e) => setForm({ ...form, product_type: e.target.value })}
                    placeholder="Diesel / Lube"
                  />
                </Field>
                <Field label="Operator">
                  <Input
                    data-testid="input-operator"
                    className={inputCls}
                    value={form.operator}
                    onChange={(e) => setForm({ ...form, operator: e.target.value })}
                    placeholder="Nama analis"
                  />
                </Field>
                <Field label="Tanggal Uji">
                  <Input
                    data-testid="input-test-date"
                    type="date"
                    className={inputCls}
                    value={form.test_date}
                    onChange={(e) => setForm({ ...form, test_date: e.target.value })}
                  />
                </Field>
                <Field label={module.ratingLabel}>
                  <Select
                    value={form.rating}
                    onValueChange={(v) => setForm({ ...form, rating: v })}
                  >
                    <SelectTrigger data-testid="select-rating" className={inputCls}>
                      <SelectValue placeholder="Pilih" />
                    </SelectTrigger>
                    <SelectContent className="border-zinc-800 bg-zinc-900 text-zinc-100">
                      {module.ratingOptions.map((o) => (
                        <SelectItem key={o} value={o} data-testid={`rating-opt-${o}`}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="pt-1">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Parameter Uji
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {module.parameters.map((p) => (
                    <Field key={p.key} label={`${p.label}${p.unit ? ` (${p.unit})` : ""}`}>
                      <Input
                        data-testid={`param-${p.key}`}
                        type={p.type === "number" ? "number" : "text"}
                        step="any"
                        className={inputCls}
                        value={form.parameters[p.key]}
                        onChange={(e) => setParam(p.key, e.target.value)}
                      />
                    </Field>
                  ))}
                </div>
              </div>

              <Field label="Catatan">
                <Textarea
                  data-testid="input-notes"
                  className={inputCls}
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Observasi tambahan..."
                />
              </Field>

              <Button
                type="submit"
                data-testid="submit-sample-btn"
                disabled={createMut.isPending}
                className="w-full rounded-md bg-amber-500 font-medium text-zinc-950 hover:bg-amber-400"
              >
                {createMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Simpan Sampel
              </Button>
            </form>
          </div>
        </motion.div>

        {/* Results table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-3"
        >
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40">
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <h2 className="font-heading text-base font-semibold text-zinc-100">
                Hasil Pengujian
              </h2>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500">
                      Kode / Nama
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500">
                      Rating
                    </TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500">
                      AI
                    </TableHead>
                    <TableHead className="text-right text-[11px] uppercase tracking-wider text-zinc-500">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow className="border-zinc-800">
                      <TableCell colSpan={4} className="py-10 text-center text-zinc-500">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : samples.length === 0 ? (
                    <TableRow className="border-zinc-800">
                      <TableCell colSpan={4} className="py-12 text-center text-sm text-zinc-500">
                        Belum ada data sampel. Tambahkan lewat form di kiri.
                      </TableCell>
                    </TableRow>
                  ) : (
                    samples.map((s) => (
                      <TableRow
                        key={s.id}
                        data-testid={`sample-row-${s.id}`}
                        className="border-zinc-800/60 transition-colors hover:bg-zinc-800/20"
                      >
                        <TableCell>
                          <div className="font-mono text-xs text-amber-500">{s.sample_code}</div>
                          <div className="text-sm text-zinc-200">{s.sample_name}</div>
                          <div className="text-xs text-zinc-500">
                            {s.product_type || "-"} · {s.test_date || "-"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {s.rating ? (
                            <Badge className="border border-zinc-700 bg-zinc-800 font-mono text-xs text-zinc-100">
                              {s.rating}
                            </Badge>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.ai_analysis ? (
                            <Badge className="border border-blue-500/20 bg-blue-500/10 text-blue-400">
                              <Bot className="mr-1 h-3 w-3" /> Ready
                            </Badge>
                          ) : (
                            <span className="text-xs text-zinc-600">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <IconBtn
                              testid={`analyze-btn-${s.id}`}
                              title="Analisa AI"
                              onClick={() => analyzeMut.mutate(s.id)}
                              disabled={analyzeMut.isPending && analyzeMut.variables === s.id}
                            >
                              {analyzeMut.isPending && analyzeMut.variables === s.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                            </IconBtn>
                            <IconBtn
                              testid={`view-btn-${s.id}`}
                              title="Lihat detail"
                              onClick={() => setViewSample(s)}
                            >
                              <Eye className="h-4 w-4" />
                            </IconBtn>
                            <IconBtn
                              testid={`export-btn-${s.id}`}
                              title="Export PDF"
                              onClick={() => exportSamplePdf(module, s)}
                            >
                              <FileDown className="h-4 w-4" />
                            </IconBtn>
                            <IconBtn
                              testid={`delete-btn-${s.id}`}
                              title="Hapus"
                              danger
                              onClick={() => deleteMut.mutate(s.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconBtn>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!viewSample} onOpenChange={(o) => !o && setViewSample(null)}>
        <DialogContent
          data-testid="sample-detail-dialog"
          className="max-h-[85vh] max-w-2xl overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100"
        >
          {viewSample && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-2 text-xl">
                  <span className="font-mono text-amber-500">{viewSample.sample_code}</span>
                  <span className="text-zinc-500">·</span>
                  {viewSample.sample_name}
                </DialogTitle>
                <DialogDescription className="text-zinc-500">
                  Detail hasil pengujian & analisa AI sampel.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Jenis Produk" value={viewSample.product_type} />
                <Info label="Operator" value={viewSample.operator} />
                <Info label="Tanggal Uji" value={viewSample.test_date} />
                <Info label={module.ratingLabel} value={viewSample.rating} />
              </div>

              <div className="mt-3 rounded-md border border-zinc-800">
                <table className="w-full text-sm">
                  <tbody>
                    {module.parameters.map((p, i) => (
                      <tr key={p.key} className={i % 2 ? "bg-zinc-900/40" : ""}>
                        <td className="px-4 py-2 text-zinc-400">{p.label}</td>
                        <td className="px-4 py-2 text-right font-mono text-zinc-100">
                          {viewSample.parameters?.[p.key] || "-"}
                          {viewSample.parameters?.[p.key] && p.unit ? ` ${p.unit}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {viewSample.notes && (
                <div className="mt-3 text-sm">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Catatan
                  </div>
                  <p className="mt-1 text-zinc-300">{viewSample.notes}</p>
                </div>
              )}

              <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/[0.06] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-400">
                  <Bot className="h-4 w-4" /> Analisa AI
                </div>
                {viewSample.ai_analysis ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                    {viewSample.ai_analysis}
                  </p>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-zinc-500">Belum ada analisa AI.</p>
                    <Button
                      data-testid="dialog-analyze-btn"
                      size="sm"
                      onClick={() => analyzeMut.mutate(viewSample.id)}
                      disabled={analyzeMut.isPending}
                      className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
                    >
                      {analyzeMut.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Analisa Sekarang
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-2 flex justify-end">
                <Button
                  data-testid="dialog-export-btn"
                  variant="secondary"
                  onClick={() => exportSamplePdf(module, viewSample)}
                  className="border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                >
                  <FileDown className="mr-2 h-4 w-4" /> Export PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500">
      {label}
    </Label>
    {children}
  </div>
);

const Info = ({ label, value }) => (
  <div>
    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
      {label}
    </div>
    <div className="mt-0.5 text-zinc-100">{value || "-"}</div>
  </div>
);

const IconBtn = ({ children, onClick, title, testid, danger, disabled }) => (
  <button
    data-testid={testid}
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={`rounded-md p-2 transition-colors duration-200 disabled:opacity-50 ${
      danger
        ? "text-zinc-400 hover:bg-rose-500/10 hover:text-rose-400"
        : "text-zinc-400 hover:bg-zinc-800 hover:text-amber-400"
    }`}
  >
    {children}
  </button>
);
