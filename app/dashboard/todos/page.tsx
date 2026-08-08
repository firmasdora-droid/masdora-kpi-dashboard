"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentYear,
  getCurrentMonth,
  getCurrentWeekOfMonth,
} from "@/lib/period";
import WeekPicker, { WeekValue } from "@/components/WeekPicker";
import TeamTodoReport from "@/components/dashboard/TeamTodoReport";
import type {
  Profile,
  Todo,
  TodoPriority,
  TodoStatus,
  WeeklySubmission,
} from "@/types/database";

const PRIORITIES: TodoPriority[] = ["tinggi", "sederhana", "rendah"];
const STATUSES: TodoStatus[] = ["belum", "proses", "tangguh", "siap"];
const HARI = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"];

interface DraftTodo {
  title: string;
  tag: string;
  priority: TodoPriority;
  status: TodoStatus;
  pct: number;
  note: string;
  day: string;
}

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
};

const EMPTY_DRAFT: DraftTodo = {
  title: "",
  tag: "Lain-lain",
  priority: "sederhana",
  status: "belum",
  pct: 0,
  note: "",
  day: "Isnin",
};

/** Heuristik deadline mudah: Jumaat jam 5:00 petang minggu semasa. */
function isBeforeDeadline(): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=Ahad ... 5=Jumaat
  if (day < 5) return true;
  if (day > 5) return false;
  return now.getHours() < 17;
}

export default function TodosPage() {
  const supabase = createClient();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [week, setWeek] = useState<WeekValue>({
    year: getCurrentYear(),
    month: getCurrentMonth(),
    week: getCurrentWeekOfMonth(),
  });
  const [todos, setTodos] = useState<Todo[]>([]);
  const [submission, setSubmission] = useState<WeeklySubmission | null>(null);
  const [draft, setDraft] = useState<DraftTodo>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle<Pick<Profile, "role">>();
        setRole(prof?.role ?? null);
      }
      setRoleLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data: todoRows }, { data: sub }] = await Promise.all([
      supabase
        .from("todos")
        .select("*")
        .eq("user_id", userId)
        .eq("year", week.year)
        .eq("month", week.month)
        .eq("week", week.week)
        .order("sort_order"),
      supabase
        .from("weekly_submissions")
        .select("*")
        .eq("user_id", userId)
        .eq("year", week.year)
        .eq("month", week.month)
        .eq("week", week.week)
        .maybeSingle<WeeklySubmission>(),
    ]);
    setTodos((todoRows as Todo[]) ?? []);
    setSubmission(sub ?? null);
    setLoading(false);
  }, [userId, week, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    if (!userId || !draft.title.trim()) return;
    setMessage(null);
    const { error } = await supabase.from("todos").insert({
      user_id: userId,
      year: week.year,
      month: week.month,
      week: week.week,
      title: draft.title,
      tag: draft.tag,
      priority: draft.priority,
      status: draft.status,
      pct: draft.pct,
      note: draft.note,
      day: draft.day,
      sort_order: todos.length,
    });
    if (error) {
      setMessage("Gagal menambah tugasan: " + error.message);
      return;
    }
    setDraft(EMPTY_DRAFT);
    load();
  }

  async function handleUpdate(todo: Todo, patch: Partial<Todo>) {
    setMessage(null);
    const { error } = await supabase
      .from("todos")
      .update({
        ...patch,
        done_at: patch.status === "siap" ? new Date().toISOString() : todo.done_at,
      })
      .eq("id", todo.id);
    if (error) {
      setMessage("Gagal mengemas kini: " + error.message);
      return;
    }
    load();
  }

  async function handleDelete(todo: Todo) {
    setMessage(null);
    const { error } = await supabase.from("todos").delete().eq("id", todo.id);
    if (error) {
      setMessage("Gagal memadam: " + error.message);
      return;
    }
    load();
  }

  async function handleSubmitWeek() {
    if (!userId) return;
    setMessage(null);
    const onTime = isBeforeDeadline();
    const { error } = await supabase.from("weekly_submissions").upsert(
      {
        user_id: userId,
        year: week.year,
        month: week.month,
        week: week.week,
        submitted_at: new Date().toISOString(),
        on_time: onTime,
      },
      { onConflict: "user_id,year,month,week" }
    );
    if (error) {
      setMessage("Gagal menghantar: " + error.message);
      return;
    }
    setMessage(
      onTime
        ? "Berjaya dihantar tepat pada masanya."
        : "Dihantar, tetapi lewat daripada tarikh akhir (Jumaat 5:00 petang)."
    );
    load();
  }

  // Marketing Manager & CEO tidak perlu isi to-do sendiri —
  // mereka melihat laporan team secara langsung.
  if (!roleLoaded) {
    return <p className="text-sm text-muted">Memuatkan...</p>;
  }
  if (role === "manager" || role === "ceo") {
    return <TeamTodoReport />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">
          Weekly To-Do List Team
        </h2>
        <p className="text-sm text-muted">
          Kemas kini tugasan anda. Wajib dihantar setiap{" "}
          <strong className="text-amber-300">Jumaat sebelum 5:00 petang</strong>.
        </p>
      </div>

      <motion.div {...cardMotion} className="card space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <WeekPicker value={week} onChange={setWeek} />
          <div className="text-right">
            <p className="text-xs text-muted">
              {submission?.submitted_at
                ? `Dihantar pada ${new Date(submission.submitted_at).toLocaleString(
                    "ms-MY"
                  )} - ${submission.on_time ? "Tepat masa" : "Lewat"}`
                : "Belum dihantar minggu ini"}
            </p>
            <button className="btn-primary mt-2" onClick={handleSubmitWeek}>
              Hantar minggu ini
            </button>
          </div>
        </div>
        {message && <p className="text-sm text-brand-400">{message}</p>}
      </motion.div>

      <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.06 }} className="card">
        <h3 className="mb-3 font-semibold text-white">Tambah Tugasan</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input
            className="input md:col-span-2"
            placeholder="Tajuk tugasan"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <input
            className="input"
            placeholder="Tag"
            value={draft.tag}
            onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
          />
          <select
            className="input"
            value={draft.priority}
            onChange={(e) =>
              setDraft({ ...draft, priority: e.target.value as TodoPriority })
            }
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={draft.day}
            onChange={(e) => setDraft({ ...draft, day: e.target.value })}
          >
            {HARI.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={handleAdd}>
            Tambah
          </button>
        </div>
      </motion.div>

      {loading ? (
        <p className="text-sm text-muted">Memuatkan...</p>
      ) : todos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-muted">
          Tiada tugasan untuk minggu ini lagi.
        </div>
      ) : (
        <div className="card space-y-3">
          {todos.map((todo, i) => (
            <TodoItem
              key={todo.id}
              index={i}
              todo={todo}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TodoItem({
  todo,
  index = 0,
  onUpdate,
  onDelete,
}: {
  todo: Todo;
  index?: number;
  onUpdate: (todo: Todo, patch: Partial<Todo>) => void;
  onDelete: (todo: Todo) => void;
}) {
  const [note, setNote] = useState(todo.note ?? "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.4, 0, 0.2, 1] }}
      className="grid grid-cols-1 gap-3 border-b border-white/10 pb-3 last:border-0 md:grid-cols-12 md:items-center"
    >
      <div className="md:col-span-3">
        <p className="text-sm font-medium text-white">{todo.title}</p>
        <p className="text-xs text-muted">
          {todo.tag} · {todo.day}
        </p>
      </div>
      <div className="md:col-span-2">
        <select
          className="input"
          value={todo.priority}
          onChange={(e) =>
            onUpdate(todo, { priority: e.target.value as TodoPriority })
          }
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <select
          className="input"
          value={todo.status}
          onChange={(e) =>
            onUpdate(todo, { status: e.target.value as TodoStatus })
          }
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <input
          type="number"
          min={0}
          max={100}
          className="input"
          value={todo.pct}
          onChange={(e) => onUpdate(todo, { pct: Number(e.target.value) })}
        />
      </div>
      <div className="md:col-span-2">
        <input
          className="input"
          placeholder="Catatan"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => onUpdate(todo, { note })}
        />
      </div>
      <div className="md:col-span-1 text-right">
        <button
          className="text-xs font-medium text-red-400 hover:underline"
          onClick={() => onDelete(todo)}
        >
          Padam
        </button>
      </div>
    </motion.div>
  );
}
