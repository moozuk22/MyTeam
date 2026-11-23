"use client";

import { Fragment, useId, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { CalendarDays } from "lucide-react";
import { TimeInput } from "@/components/TimeInput";
import {
  documentBottomGroups, exerciseFields, sessionFields, sectionTitles,
  type DocumentSection, type DrawingSnapshot, weekDays, type Merge, type PlanContent, type SessionFields,
} from "@/lib/exercise/document";
import FinanceSkeleton from "../../members/_components/FinanceSkeleton";
import DrawingPicker from "./DrawingPicker";

const PlanPreview = dynamic(() => import("../PlanPreview"), {
  ssr: false, loading: () => <FinanceSkeleton variant="chart" />,
});

function Field({ label, value, max, type, id: customId, heading, wrapHeading, readOnly, onChange }: {
  label: string; value: string; max: number; type?: string; id?: string; heading?: boolean; wrapHeading?: boolean; readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  const generatedId = useId();
  const id = customId ?? generatedId;
  const className = heading ? "td-field td-inline-heading" : max >= 250 ? "td-field td-field-wide" : "td-field";
  return <div className={className}>
    <label className={heading ? "td-sr-only" : undefined} htmlFor={id}>{label}</label>
    {max >= 250 || wrapHeading
      ? <textarea id={id} value={value} maxLength={max} rows={wrapHeading ? 1 : 2} readOnly={readOnly}
          placeholder={wrapHeading ? label : undefined} onChange={(event) => onChange(event.target.value)} />
      : type === "weekday"
        ? <select id={id} value={value} disabled={readOnly} onChange={(event) => onChange(event.target.value)}>
            <option value="">Изберете ден</option>
            {/* Keep a free-text day from older plans until the coach picks a weekday. */}
            {value && !(weekDays as readonly string[]).includes(value) && <option value={value}>{value}</option>}
            {weekDays.map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
      : type === "time"
        ? <TimeInput id={id} step={60} value={value} readOnly={readOnly} onValueChange={onChange} />
        : type === "date"
        ? <span className="td-date-field">
            <span className={value ? "td-date-value" : "td-date-value td-date-empty"} aria-hidden="true">{value ? value.split("-").reverse().join(".") : "дд.мм.гггг"}</span>
            <input id={id} type="date" value={value} readOnly={readOnly}
              onClick={(event) => { try { event.currentTarget.showPicker(); } catch { /* Keep the native field editable where showPicker is unavailable. */ } }}
              onChange={(event) => onChange(event.target.value)} />
            <CalendarDays size={16} aria-hidden="true" />
          </span>
        : <input id={id} type={type ?? "text"} value={value} maxLength={max} readOnly={readOnly} placeholder={heading ? label : undefined}
          onChange={(event) => onChange(event.target.value)} />}
  </div>;
}

export default function DocumentFields({ content, disabled, drawingEndpoint, location, sessionSlot, onSession, onSection, onDrawing, onMerge }: {
  content: PlanContent; disabled: boolean; drawingEndpoint: string; location: string;
  /** Replaces the default text field of a session field, for example with a field that has suggestions. */
  sessionSlot?: (key: keyof SessionFields) => ReactNode;
  onSession: (key: keyof SessionFields, value: string) => void;
  onSection: (index: number, patch: Partial<DocumentSection>) => void;
  onDrawing: (index: number, drawing: DrawingSnapshot | null) => void;
  onMerge: (merge: Merge) => void;
}) {
  const [activePicker, setActivePicker] = useState<number>();
  const pickerButtons = useRef<Record<number, HTMLButtonElement | null>>({});

  function closePicker(index: number) {
    setActivePicker(undefined);
    requestAnimationFrame(() => pickerButtons.current[index]?.focus());
  }

  function sessionField([key, label, max, type]: typeof sessionFields[number], heading = false, readOnly = false) {
    const slot = sessionSlot?.(key);
    if (slot !== undefined) return <Fragment key={key}>{slot}</Fragment>;
    return <Field key={key} id={key === "title" ? "td-plan-title" : undefined} heading={heading} readOnly={readOnly}
      label={label} max={max} type={type} value={content.session[key]} onChange={(value) => onSession(key, value)} />;
  }

  function exerciseGroup(indices: number[]) {
    const drawings = indices.filter((index) => content.sections[index].drawing);
    return <div className={indices.length === 2 ? "td-edit-cell td-edit-shared" : "td-edit-cell"} key={indices.join(":")}>
      <div className="td-edit-split">
        {indices.map((index) => {
          const section = content.sections[index];
          return <section key={index} aria-label={section.title || sectionTitles[index]}>
            <Field heading wrapHeading label={`Заглавие на секцията · ${sectionTitles[index]}`} max={120} value={section.title}
              onChange={(value) => onSection(index, { title: value })} />
            <div className="td-fields">
              {exerciseFields.slice(2, 3).map(([key, label, max]) => <Field key={key} label={label} max={max}
                value={section[key]} onChange={(value) => onSection(index, { [key]: value })} />)}
            </div>
          </section>;
        })}
      </div>
      <div className="td-edit-drawing">
        {!!drawings.length && <div className="td-edit-split">
          {drawings.map((index) => {
            const drawing = content.sections[index].drawing!;
            return <figure key={index}>
              <div className="td-edit-pitch"><PlanPreview exercise={drawing.layout} landscape /></div>
              <figcaption>{drawing.title}</figcaption>
            </figure>;
          })}
        </div>}
        <div className="td-edit-split">
          {indices.map((index) => {
            const drawing = content.sections[index].drawing;
            return <div key={index} className="td-drawing-actions">
              {indices.length === 2 && <span className="td-shared-label">{content.sections[index].title || sectionTitles[index]}</span>}
              <button type="button" className="tp-secondary-btn" aria-expanded={activePicker === index}
                ref={(button) => { pickerButtons.current[index] = button; }}
                onClick={() => setActivePicker(activePicker === index ? undefined : index)}>
                {drawing ? "Смени упражнението" : "Добави упражнение"}
              </button>
              {drawing && <button type="button" className="tp-secondary-btn" onClick={() => onDrawing(index, null)}>Премахни</button>}
            </div>;
          })}
        </div>
        {activePicker !== undefined && indices.includes(activePicker) && <DrawingPicker key={activePicker} endpoint={drawingEndpoint} location={location}
          onPick={(drawing) => { onDrawing(activePicker, drawing); closePicker(activePicker); }} onClose={() => closePicker(activePicker)} />}
      </div>
      <div className="td-edit-split td-edit-footer">
        {indices.map((index) => <div key={index} className="td-fields">
          {indices.length === 2 && <span className="td-shared-label">{content.sections[index].title || sectionTitles[index]}</span>}
          {exerciseFields.slice(3).map(([key, label, max]) => <Field key={key} label={label} max={max}
            value={content.sections[index][key]} onChange={(value) => onSection(index, { [key]: value })} />)}
        </div>)}
      </div>
    </div>;
  }

  return <fieldset className="td-editor" disabled={disabled} aria-label="Полета на план-конспекта">
    <div className="td-edit-paper">
      <div className="td-edit-header">
        {sessionField(sessionFields[0], true)}
        <div className="td-edit-season">
          {sessionFields.slice(1, 3).map((field) => sessionField(field, true, true))}
        </div>
      </div>
      <div className="td-edit-row td-edit-top">
        {exerciseGroup([0])}
        {exerciseGroup([1])}
        <section className="td-edit-cell td-edit-session" aria-label="Данни за тренировката">
          <h2>Данни за тренировката</h2>
          <div className="td-fields">{sessionFields.slice(3).filter(([key]) => key !== "group").map((field) => sessionField(field))}</div>
        </section>
      </div>
      <div className="td-field td-layout-control">
        <label htmlFor="td-merge-placement">Подредба на долния ред</label>
        <select id="td-merge-placement" value={content.merge} onChange={(event) => onMerge(event.target.value as Merge)}>
          <option value="none">Отделни секции</option>
          <option value="left">Обща зона за фази №2 и №3</option>
          <option value="right">Обща зона за фаза №3 и игровата форма</option>
        </select>
      </div>
      <div className="td-edit-row td-edit-bottom">
        {documentBottomGroups(content.merge).map(exerciseGroup)}
      </div>
    </div>
  </fieldset>;
}
