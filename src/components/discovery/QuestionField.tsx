"use client";

import { useEffect, useRef, useState } from "react";
import type { AnswerValue, QuestionDescriptor } from "./types";
import styles from "./QuestionField.module.css";

/**
 * Renders one question as a real, accessible native control -- never
 * a div-only pseudo-form (Phase 3 instruction §47). Single/multi
 * render as a fieldset of radio/checkbox inputs visually styled as
 * cards/chips; the native input stays present and focusable (just
 * visually hidden), so keyboard and screen-reader behavior is exactly
 * native radio/checkbox semantics, not a re-implementation of it.
 *
 * Selection controls call `onCommit` immediately (Phase 3 instruction
 * §9: "save promptly after a committed selection"); short_text
 * debounces locally and flushes on blur or when `forceFlushRef` is
 * invoked (stage navigation calls this before advancing).
 */
export function QuestionField({
  question,
  value,
  onCommit,
  error,
  gradeLabelForAge,
  otherTextValue,
}: {
  question: QuestionDescriptor;
  value: AnswerValue;
  onCommit: (field: string, value: AnswerValue) => void;
  error?: string | undefined;
  /** Optional context line shown under DISC_003 (student age) -- purely informational, never gates anything. */
  gradeLabelForAge?: string | undefined;
  /** Phase 3F: current value of `question.otherTextField`, when declared. Ignored otherwise. */
  otherTextValue?: AnswerValue;
}) {
  const errorId = `${question.field}-error`;
  const legendId = `${question.field}-legend`;
  const describedBy = error ? errorId : undefined;
  // single/multi give each individual radio/checkbox its own <label>,
  // which is already a real accessible name -- the legend just adds
  // group context there. short_text/integer_or_unknown/location have
  // exactly one control each with no label of its own, so that
  // control's accessible name must come from this legend explicitly
  // (a <legend> alone does not auto-label a single nested control).
  const needsExplicitLabel =
    question.inputType === "short_text" || question.inputType === "integer_or_unknown";

  return (
    <fieldset className={styles.field} aria-describedby={describedBy}>
      <legend className={styles.legend} id={needsExplicitLabel ? legendId : undefined}>
        {question.wording}
        {question.required ? null : <span className={styles.optional}> (optional)</span>}
      </legend>
      {question.helperText ? <p className={styles.hint}>{question.helperText}</p> : null}

      {question.inputType === "single" || question.inputType === "single_from_previous" ? (
        <SingleChoice question={question} value={value} onCommit={onCommit} />
      ) : question.inputType === "multi" ? (
        <MultiChoice question={question} value={value} onCommit={onCommit} otherTextValue={otherTextValue} />
      ) : question.inputType === "short_text" ? (
        <ShortText question={question} value={value} onCommit={onCommit} labelledBy={legendId} />
      ) : question.inputType === "integer_or_unknown" ? (
        <IntegerOrUnknown question={question} value={value} onCommit={onCommit} labelledBy={legendId} />
      ) : question.inputType === "location" ? (
        <LocationInput question={question} value={value} onCommit={onCommit} />
      ) : null}

      {gradeLabelForAge ? <p className={styles.hint}>{gradeLabelForAge}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

function SingleChoice({
  question,
  value,
  onCommit,
}: {
  question: QuestionDescriptor;
  value: AnswerValue;
  onCommit: (field: string, value: AnswerValue) => void;
}) {
  const current = typeof value === "string" ? value : undefined;
  return (
    <div className={styles.optionGrid}>
      {(question.options ?? []).map((option) => {
        const id = `${question.field}-${option.value}`;
        const checked = current === option.value;
        return (
          <label key={option.value} htmlFor={id} className={styles.option} data-checked={checked}>
            <input
              id={id}
              type="radio"
              className={styles.nativeControl}
              name={question.field}
              value={option.value}
              checked={checked}
              onChange={() => onCommit(question.field, option.value)}
            />
            <span className={styles.checkMark} aria-hidden="true" />
            <span className={styles.optionLabel}>
              {option.label}
              {option.helper ? <span className={styles.optionHelper}>{option.helper}</span> : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function MultiChoice({
  question,
  value,
  onCommit,
  otherTextValue,
}: {
  question: QuestionDescriptor;
  value: AnswerValue;
  onCommit: (field: string, value: AnswerValue) => void;
  otherTextValue?: AnswerValue;
}) {
  const current = Array.isArray(value) ? value : [];
  const maxSelections = question.maxSelections;
  const atLimit = Boolean(maxSelections && current.length >= maxSelections);

  // Phase 3E: DISC_022's NONE_CURRENTLY joins the existing client-side
  // exclusive set (mirrors EXTRA_EXCLUSIVE_VALUES in validation.ts, the
  // server-authoritative source of truth this only shadows for UX).
  const EXCLUSIVE_VALUES = ["NONE", "UNKNOWN", "EXPLORING", "NONE_CURRENTLY"];

  function toggle(optionValue: string) {
    const exclusive = EXCLUSIVE_VALUES.includes(optionValue);
    const alreadySelected = current.includes(optionValue);

    let next: string[];
    if (alreadySelected) {
      next = current.filter((v) => v !== optionValue);
    } else if (exclusive) {
      next = [optionValue];
    } else {
      // Selecting a substantive choice removes any exclusive value already selected.
      next = [...current.filter((v) => !EXCLUSIVE_VALUES.includes(v)), optionValue];
    }
    onCommit(question.field, next);

    // Phase 3F: unchecking OTHER also clears its inline sidecar text --
    // both here (client UX) and, independent of whether this call
    // succeeds, in computeEffectiveAnswers (server-authoritative).
    if (optionValue === "OTHER" && alreadySelected && question.otherTextField) {
      onCommit(question.otherTextField, undefined);
    }
  }

  return (
    <div className={styles.optionGrid}>
      {(question.options ?? []).map((option) => {
        const id = `${question.field}-${option.value}`;
        const checked = current.includes(option.value);
        const disabled = !checked && atLimit;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={styles.option}
            data-checked={checked}
            data-disabled={disabled}
          >
            <input
              id={id}
              type="checkbox"
              className={styles.nativeControl}
              name={question.field}
              value={option.value}
              checked={checked}
              disabled={disabled}
              onChange={() => toggle(option.value)}
            />
            <span className={styles.checkMark} aria-hidden="true" />
            <span className={styles.optionLabel}>
              {option.label}
              {option.helper ? <span className={styles.optionHelper}>{option.helper}</span> : null}
            </span>
          </label>
        );
      })}
      {question.otherTextField && current.includes("OTHER") ? (
        <OtherTextInput field={question.otherTextField} value={otherTextValue} onCommit={onCommit} />
      ) : null}
      {maxSelections ? (
        <p className={styles.hint}>
          Choose up to {maxSelections}
          {current.length > 0 ? ` (${current.length} of ${maxSelections} chosen)` : ""}.
        </p>
      ) : null}
    </div>
  );
}

const OTHER_TEXT_MAX_LENGTH = 150;

/**
 * Phase 3F: the inline free-text box revealed under an "Other"
 * selection. Deliberately its own component -- mounted only while
 * OTHER is checked (see MultiChoice above), so there is no stale-value
 * resync concern: unchecking OTHER unmounts it, and rechecking it
 * mounts a fresh instance from whatever `value` currently holds.
 */
function OtherTextInput({
  field,
  value,
  onCommit,
}: {
  field: string;
  value: AnswerValue;
  onCommit: (field: string, value: AnswerValue) => void;
}) {
  const [local, setLocal] = useState(typeof value === "string" ? value : "");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  function handleChange(next: string) {
    setLocal(next);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onCommit(field, next), 500);
  }

  function flush() {
    clearTimeout(timeoutRef.current);
    onCommit(field, local);
  }

  return (
    <div className={styles.otherTextRow}>
      <label htmlFor={`${field}-input`} className={styles.otherTextLabel}>
        Please describe (optional context for your advisor)
      </label>
      <input
        id={`${field}-input`}
        type="text"
        className={styles.textInput}
        value={local}
        maxLength={OTHER_TEXT_MAX_LENGTH}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={flush}
      />
      <p className={styles.hint}>
        {local.length} / {OTHER_TEXT_MAX_LENGTH}
      </p>
    </div>
  );
}

function ShortText({
  question,
  value,
  onCommit,
  labelledBy,
}: {
  question: QuestionDescriptor;
  value: AnswerValue;
  onCommit: (field: string, value: AnswerValue) => void;
  labelledBy: string;
}) {
  // Initialized once per mounted instance from the server-confirmed
  // value. Deliberately never resynced from a later `value` prop
  // change while mounted (e.g. a router.refresh() triggered by a
  // sibling field's save): a local edit in progress must always win
  // over a prop update, never be silently clobbered by one. Switching
  // to a genuinely different question always mounts a fresh instance
  // (DiscoveryQuestionnaire keys each QuestionField by question.id).
  const [local, setLocal] = useState(typeof value === "string" ? value : "");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  function handleChange(next: string) {
    setLocal(next);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => onCommit(question.field, next), 500);
  }

  function flush() {
    clearTimeout(timeoutRef.current);
    onCommit(question.field, local);
  }

  const isLong = (question.textMaxLength ?? 0) > 100;

  return (
    <div>
      {isLong ? (
        <textarea
          className={styles.textInput}
          rows={4}
          value={local}
          maxLength={question.textMaxLength}
          aria-labelledby={labelledBy}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={flush}
        />
      ) : (
        <input
          type="text"
          className={styles.textInput}
          value={local}
          maxLength={question.textMaxLength}
          aria-labelledby={labelledBy}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={flush}
        />
      )}
      {question.textMaxLength ? (
        <p className={styles.hint}>
          {local.length} / {question.textMaxLength}
        </p>
      ) : null}
    </div>
  );
}

function IntegerOrUnknown({
  question,
  value,
  onCommit,
  labelledBy,
}: {
  question: QuestionDescriptor;
  value: AnswerValue;
  onCommit: (field: string, value: AnswerValue) => void;
  labelledBy: string;
}) {
  const isUnknown = value === "UNKNOWN";
  const numericValue = typeof value === "number" ? value : "";

  return (
    <div className={styles.integerRow}>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        className={styles.numberInput}
        value={isUnknown ? "" : numericValue}
        disabled={isUnknown}
        aria-labelledby={labelledBy}
        onChange={(e) => {
          const parsed = e.target.value === "" ? undefined : Number(e.target.value);
          onCommit(question.field, parsed);
        }}
      />
      <label className={styles.unknownToggle}>
        <input
          type="checkbox"
          className={styles.nativeControl}
          checked={isUnknown}
          onChange={(e) => onCommit(question.field, e.target.checked ? "UNKNOWN" : undefined)}
        />
        I&apos;m not sure
      </label>
    </div>
  );
}

function LocationInput({
  question,
  value,
  onCommit,
}: {
  question: QuestionDescriptor;
  value: AnswerValue;
  onCommit: (field: string, value: AnswerValue) => void;
}) {
  const current =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as { state: string; zip?: string })
      : { state: "" };

  function commit(next: { state: string; zip?: string | undefined }) {
    onCommit(question.field, next.state ? next : undefined);
  }

  return (
    <div className={styles.locationRow}>
      <select
        className={styles.selectInput}
        value={current.state}
        aria-label="State or territory"
        onChange={(e) => commit({ ...current, state: e.target.value })}
      >
        <option value="" disabled>
          Choose one
        </option>
        {(question.locationStates ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        inputMode="numeric"
        placeholder="ZIP (optional)"
        aria-label="ZIP code (optional)"
        className={styles.textInput}
        defaultValue={current.zip ?? ""}
        maxLength={10}
        onBlur={(e) => commit({ ...current, zip: e.target.value || undefined })}
      />
    </div>
  );
}
