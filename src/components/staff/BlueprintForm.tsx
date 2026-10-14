import type { BlueprintContent, Provenance } from "@/lib/blueprint/content-schema";
import {
  PROVENANCE_VALUES,
  ACADEMIC_PLANNING_DOMAINS,
  SCHEDULE_LIFESTYLE_FACTORS,
  OPPORTUNITY_HORIZONS,
  SUPPORT_FRAMINGS,
  VERIFICATION_CATEGORIES,
  VERIFICATION_STATUSES,
  ACTION_OWNERS,
  ACTION_STATUSES,
} from "@/lib/blueprint/content-schema";
import type { TaxonomyOption } from "@/server/blueprint";
import { statusLabel } from "./format";
import styles from "./staff-page.module.css";

/** Generous, fixed row counts for the three advisor-authored item lists (section 44 design note: a plain-HTML form with no client JS manages a fixed set of candidate rows rather than a dynamic add/remove list; well within each section's schema max of 40/40/20). */
export const B09_ROW_COUNT = 12;
export const B10_ROW_COUNT = 12;
export const B11_ROW_COUNT = 8;

function ProvenanceSelect({ name, value }: { name: string; value: Provenance }) {
  return (
    <>
      <label htmlFor={name}>Information source</label>
      <select id={name} name={name} defaultValue={value}>
        {PROVENANCE_VALUES.map((v) => (
          <option key={v} value={v}>
            {statusLabel(v)}
          </option>
        ))}
      </select>
    </>
  );
}

function TextField({
  name,
  label,
  value,
  rows = 3,
  placeholder,
}: {
  name: string;
  label: string;
  value: string | undefined;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <>
      <label htmlFor={name}>{label}</label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={value ?? ""}
        className={styles.textarea}
        placeholder={placeholder}
      />
    </>
  );
}

function LinesField({ name, label, values }: { name: string; label: string; values: readonly string[] }) {
  return (
    <>
      <label htmlFor={name}>{label}</label>
      <p className={styles.provenanceNote}>One item per line.</p>
      <textarea id={name} name={name} rows={3} defaultValue={values.join("\n")} className={styles.textarea} />
    </>
  );
}

function CheckboxGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  selected: ReadonlySet<string>;
}) {
  return (
    <fieldset className={styles.radioGroup}>
      <legend>{legend}</legend>
      <div className={styles.checkboxGroup}>
        {options.map((opt) => (
          <label key={opt} className={styles.checkboxOption}>
            <input type="checkbox" name={name} value={opt} defaultChecked={selected.has(opt)} />
            {statusLabel(opt)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TaxonomyCheckboxGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: readonly TaxonomyOption[];
  selected: ReadonlySet<string>;
}) {
  return (
    <fieldset className={styles.radioGroup}>
      <legend>{legend}</legend>
      <div className={styles.checkboxGroup}>
        {options.map((opt) => (
          <label key={opt.id} className={styles.checkboxOption}>
            <input type="checkbox" name={name} value={opt.id} defaultChecked={selected.has(opt.id)} />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function BlueprintForm({
  pathwaysCaseId,
  revisionId,
  content,
  expectedVersion,
  baseModelOptions,
  overlayOptions,
  supportOptions,
  opportunityOptions,
  saveDraftAction,
  moveToReviewAction,
  markReadyAction,
}: {
  pathwaysCaseId: string;
  revisionId: string;
  content: BlueprintContent;
  expectedVersion: number;
  baseModelOptions: TaxonomyOption[];
  overlayOptions: TaxonomyOption[];
  supportOptions: TaxonomyOption[];
  opportunityOptions: TaxonomyOption[];
  saveDraftAction: (formData: FormData) => Promise<void>;
  moveToReviewAction: (formData: FormData) => Promise<void>;
  markReadyAction: (formData: FormData) => Promise<void>;
}) {
  const recommendedModels = new Set(content.b04.recommendedModelIds);
  const overlays = new Set(content.b04.overlayIds);
  const domains = new Set<string>(content.b05.domains);

  const considerationByFactor = new Map(content.b06.considerations.map((c) => [c.factor, c]));
  const opportunityByTaxonomyId = new Map(content.b07.items.map((i) => [i.opportunityId, i]));
  const supportByTaxonomyId = new Map(content.b08.items.map((i) => [i.supportId, i]));

  const b09Rows = Array.from({ length: B09_ROW_COUNT }, (_, i) => content.b09.items[i]);
  const b10Rows = Array.from({ length: B10_ROW_COUNT }, (_, i) => content.b10.items[i]);
  const b11Rows0 = Array.from({ length: B11_ROW_COUNT }, (_, i) => content.b11.days0to30[i]);
  const b11Rows1 = Array.from({ length: B11_ROW_COUNT }, (_, i) => content.b11.days31to60[i]);
  const b11Rows2 = Array.from({ length: B11_ROW_COUNT }, (_, i) => content.b11.days61to90[i]);

  return (
    <form action={saveDraftAction} className={styles.planningForm}>
      <input type="hidden" name="pathwaysCaseId" value={pathwaysCaseId} />
      <input type="hidden" name="revisionId" value={revisionId} />
      <input type="hidden" name="expectedVersion" value={expectedVersion} />

      <section className={styles.section} aria-labelledby="b01-heading">
        <h2 id="b01-heading" className={styles.sectionTitle}>
          B01. Student Snapshot
        </h2>
        <ProvenanceSelect name="b01Provenance" value={content.b01.provenance} />
        <TextField name="b01StudentDisplayName" label="Student display name" value={content.b01.studentDisplayName} rows={1} />
        <TextField name="b01Grade" label="Grade" value={content.b01.grade} rows={1} />
        <TextField name="b01GradeBand" label="Grade band" value={content.b01.gradeBand} rows={1} />
        <TextField name="b01CurrentEducationalContext" label="Current educational context" value={content.b01.currentEducationalContext} />
        <TextField name="b01StatedGoals" label="Stated goals" value={content.b01.statedGoals} />
        <TextField name="b01StrengthsInterests" label="Strengths and interests" value={content.b01.strengthsInterests} />
        <TextField name="b01ImportantLearningContext" label="Important learning context" value={content.b01.importantLearningContext} />
        <TextField name="b01ScheduleLifestyleFactors" label="Schedule / lifestyle factors" value={content.b01.scheduleLifestyleFactors} />
      </section>

      <section className={styles.section} aria-labelledby="b02-heading">
        <h2 id="b02-heading" className={styles.sectionTitle}>
          B02. Family Goals &amp; Priorities
        </h2>
        <ProvenanceSelect name="b02Provenance" value={content.b02.provenance} />
        <TextField name="b02ReasonForSeekingPathways" label="Reason for seeking Pathways" value={content.b02.reasonForSeekingPathways} />
        <TextField name="b02ConfirmedPrimaryGoal" label="Confirmed primary goal" value={content.b02.confirmedPrimaryGoal} />
        <LinesField name="b02MajorPriorities" label="Major priorities" values={content.b02.majorPriorities} />
        <TextField name="b02DesiredChange" label="Desired change" value={content.b02.desiredChange} />
        <LinesField name="b02NonNegotiables" label="Non-negotiables" values={content.b02.nonNegotiables} />
        <TextField name="b02LongerTermAspirations" label="Longer-term aspirations" value={content.b02.longerTermAspirations} />
      </section>

      <section className={styles.section} aria-labelledby="b03-heading">
        <h2 id="b03-heading" className={styles.sectionTitle}>
          B03. Current Educational Situation
        </h2>
        <ProvenanceSelect name="b03Provenance" value={content.b03.provenance} />
        <TextField name="b03CurrentArrangement" label="Current arrangement" value={content.b03.currentArrangement} />
        <TextField name="b03WhatIsWorking" label="What is working" value={content.b03.whatIsWorking} />
        <TextField name="b03WhatFamilyWantsToChange" label="What the family wants to change" value={content.b03.whatFamilyWantsToChange} />
        <TextField name="b03AcademicConcerns" label="Academic concerns" value={content.b03.academicConcerns} />
        <TextField name="b03SupportContext" label="Support context" value={content.b03.supportContext} />
        <TextField name="b03OperationalConstraints" label="Operational constraints" value={content.b03.operationalConstraints} />
        <LinesField name="b03UnresolvedFacts" label="Unresolved facts" values={content.b03.unresolvedFacts} />
      </section>

      <section className={styles.section} aria-labelledby="b04-heading">
        <h2 id="b04-heading" className={styles.sectionTitle}>
          B04. Recommended Educational Strategy
        </h2>
        <ProvenanceSelect name="b04Provenance" value={content.b04.provenance} />
        <TaxonomyCheckboxGroup
          legend="Recommended pathway models"
          name="b04RecommendedModelIds"
          options={baseModelOptions}
          selected={recommendedModels}
        />
        <TaxonomyCheckboxGroup legend="Overlays" name="b04OverlayIds" options={overlayOptions} selected={overlays} />
        <TextField name="b04SupportApproach" label="Support approach" value={content.b04.supportApproach} />
        <TextField name="b04AlignmentRationale" label="Alignment rationale" value={content.b04.alignmentRationale} />
        <TextField name="b04Tradeoffs" label="Tradeoffs" value={content.b04.tradeoffs} />
        <TextField name="b04RisksConsiderations" label="Risks / considerations" value={content.b04.risksConsiderations} />
        <TextField
          name="b04ConditionsRequiringVerification"
          label="Conditions requiring verification"
          value={content.b04.conditionsRequiringVerification}
        />
      </section>

      <section className={styles.section} aria-labelledby="b05-heading">
        <h2 id="b05-heading" className={styles.sectionTitle}>
          B05. Academic Planning
        </h2>
        <ProvenanceSelect name="b05Provenance" value={content.b05.provenance} />
        <CheckboxGroup legend="Academic planning domains" name="b05Domains" options={ACADEMIC_PLANNING_DOMAINS} selected={domains} />
        <TextField name="b05Narrative" label="Narrative" value={content.b05.narrative} />
      </section>

      <section className={styles.section} aria-labelledby="b06-heading">
        <h2 id="b06-heading" className={styles.sectionTitle}>
          B06. Schedule &amp; Lifestyle Plan
        </h2>
        <ProvenanceSelect name="b06Provenance" value={content.b06.provenance} />
        <fieldset className={styles.radioGroup}>
          <legend>Schedule / lifestyle considerations</legend>
          {SCHEDULE_LIFESTYLE_FACTORS.map((factor) => {
            const existing = considerationByFactor.get(factor);
            return (
              <div key={factor} className={styles.itemRow}>
                <label className={styles.checkboxOption}>
                  <input type="checkbox" name={`b06Factor_${factor}`} defaultChecked={Boolean(existing)} />
                  {statusLabel(factor)}
                </label>
                <label htmlFor={`b06Notes_${factor}`} className={styles.visuallyHidden}>
                  Notes for {statusLabel(factor)}
                </label>
                <input
                  type="text"
                  id={`b06Notes_${factor}`}
                  name={`b06Notes_${factor}`}
                  defaultValue={existing?.notes ?? ""}
                  placeholder="Notes"
                  className={styles.itemTextInput}
                />
              </div>
            );
          })}
        </fieldset>
        <TextField name="b06Narrative" label="Narrative" value={content.b06.narrative} />
      </section>

      <section className={styles.section} aria-labelledby="b07-heading">
        <h2 id="b07-heading" className={styles.sectionTitle}>
          B07. Opportunities to Explore
        </h2>
        <p className={styles.provenanceNote}>Reference opportunities from the Pathways taxonomy -- leave &quot;Not included&quot; to exclude.</p>
        {opportunityOptions.map((opt) => {
          const existing = opportunityByTaxonomyId.get(opt.id);
          return (
            <div key={opt.id} className={styles.itemRow}>
              <span className={styles.itemLabel}>{opt.label}</span>
              <label htmlFor={`b07Horizon_${opt.id}`} className={styles.visuallyHidden}>
                Horizon for {opt.label}
              </label>
              <select id={`b07Horizon_${opt.id}`} name={`b07Horizon_${opt.id}`} defaultValue={existing?.horizon ?? ""}>
                <option value="">Not included</option>
                {OPPORTUNITY_HORIZONS.map((h) => (
                  <option key={h} value={h}>
                    {statusLabel(h)}
                  </option>
                ))}
              </select>
              <label htmlFor={`b07Notes_${opt.id}`} className={styles.visuallyHidden}>
                Notes for {opt.label}
              </label>
              <input
                type="text"
                id={`b07Notes_${opt.id}`}
                name={`b07Notes_${opt.id}`}
                defaultValue={existing?.notes ?? ""}
                placeholder="Notes"
                className={styles.itemTextInput}
              />
            </div>
          );
        })}
      </section>

      <section className={styles.section} aria-labelledby="b08-heading">
        <h2 id="b08-heading" className={styles.sectionTitle}>
          B08. Support Plan
        </h2>
        <p className={styles.provenanceNote}>Reference supports from the Pathways taxonomy -- leave &quot;Not included&quot; to exclude.</p>
        {supportOptions.map((opt) => {
          const existing = supportByTaxonomyId.get(opt.id);
          return (
            <div key={opt.id} className={styles.itemRow}>
              <span className={styles.itemLabel}>{opt.label}</span>
              <label htmlFor={`b08Framing_${opt.id}`} className={styles.visuallyHidden}>
                Framing for {opt.label}
              </label>
              <select id={`b08Framing_${opt.id}`} name={`b08Framing_${opt.id}`} defaultValue={existing?.framing ?? ""}>
                <option value="">Not included</option>
                {SUPPORT_FRAMINGS.map((f) => (
                  <option key={f} value={f}>
                    {statusLabel(f)}
                  </option>
                ))}
              </select>
              <label htmlFor={`b08Notes_${opt.id}`} className={styles.visuallyHidden}>
                Notes for {opt.label}
              </label>
              <input
                type="text"
                id={`b08Notes_${opt.id}`}
                name={`b08Notes_${opt.id}`}
                defaultValue={existing?.notes ?? ""}
                placeholder="Notes"
                className={styles.itemTextInput}
              />
            </div>
          );
        })}
      </section>

      <section className={styles.section} aria-labelledby="b09-heading">
        <h2 id="b09-heading" className={styles.sectionTitle}>
          B09. Verification Items
        </h2>
        <p className={styles.provenanceNote}>
          Leave the question blank to exclude a row. An item can only become &quot;Verified&quot; through a deliberate save that
          sets its status to Verified -- it is never defaulted.
        </p>
        {b09Rows.map((item, i) => (
          <div key={i} className={styles.itemRow}>
            <input type="hidden" name="b09Id" value={item?.id ?? ""} />
            <select name="b09Category" defaultValue={item?.category ?? "OTHER"}>
              {VERIFICATION_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {statusLabel(c)}
                </option>
              ))}
            </select>
            <input type="text" name="b09Question" defaultValue={item?.question ?? ""} placeholder="Question to verify" className={styles.itemTextInput} />
            <select name="b09Status" defaultValue={item?.status ?? "OPEN"}>
              {VERIFICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
            <input type="text" name="b09Owner" defaultValue={item?.owner ?? ""} placeholder="Owner" className={styles.itemTextInput} />
            <input
              type="text"
              name="b09EvidenceNote"
              defaultValue={item?.evidenceNote ?? ""}
              placeholder="Evidence note"
              className={styles.itemTextInput}
            />
          </div>
        ))}
      </section>

      <section className={styles.section} aria-labelledby="b10-heading">
        <h2 id="b10-heading" className={styles.sectionTitle}>
          B10. Action Plan
        </h2>
        <p className={styles.provenanceNote}>Leave the text blank to exclude a row.</p>
        {b10Rows.map((item, i) => (
          <div key={i} className={styles.itemRow}>
            <input type="text" name="b10Text" defaultValue={item?.text ?? ""} placeholder="Action" className={styles.itemTextInput} />
            <select name="b10Owner" defaultValue={item?.owner ?? "ADVISOR"}>
              {ACTION_OWNERS.map((o) => (
                <option key={o} value={o}>
                  {statusLabel(o)}
                </option>
              ))}
            </select>
            <input type="text" name="b10Timing" defaultValue={item?.timing ?? ""} placeholder="Timing" className={styles.itemTextInput} />
            <select name="b10Status" defaultValue={item?.status ?? "NOT_STARTED"}>
              {ACTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
            <input type="text" name="b10Notes" defaultValue={item?.notes ?? ""} placeholder="Notes" className={styles.itemTextInput} />
          </div>
        ))}
      </section>

      <section className={styles.section} aria-labelledby="b11-heading">
        <h2 id="b11-heading" className={styles.sectionTitle}>
          B11. 30 / 60 / 90-Day Roadmap
        </h2>
        <p className={styles.provenanceNote}>Leave the text blank to exclude a row.</p>
        <h3 className={styles.sectionTitle}>First 30 days</h3>
        {b11Rows0.map((item, i) => (
          <div key={i} className={styles.itemRow}>
            <input type="text" name="b11_0_Text" defaultValue={item?.text ?? ""} placeholder="Milestone" className={styles.itemTextInput} />
            <select name="b11_0_Status" defaultValue={item?.status ?? "NOT_STARTED"}>
              {ACTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
        ))}
        <h3 className={styles.sectionTitle}>Days 31-60</h3>
        {b11Rows1.map((item, i) => (
          <div key={i} className={styles.itemRow}>
            <input type="text" name="b11_1_Text" defaultValue={item?.text ?? ""} placeholder="Milestone" className={styles.itemTextInput} />
            <select name="b11_1_Status" defaultValue={item?.status ?? "NOT_STARTED"}>
              {ACTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
        ))}
        <h3 className={styles.sectionTitle}>Days 61-90</h3>
        {b11Rows2.map((item, i) => (
          <div key={i} className={styles.itemRow}>
            <input type="text" name="b11_2_Text" defaultValue={item?.text ?? ""} placeholder="Milestone" className={styles.itemTextInput} />
            <select name="b11_2_Status" defaultValue={item?.status ?? "NOT_STARTED"}>
              {ACTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </section>

      <section className={styles.section} aria-labelledby="b12-heading">
        <h2 id="b12-heading" className={styles.sectionTitle}>
          B12. Advisor Professional Summary
        </h2>
        <TextField name="b12Summary" label="Summary" value={content.b12.summary} rows={5} />
      </section>

      <div className={styles.saveControls}>
        <button type="submit" className={styles.secondaryButton}>
          Save Draft
        </button>
        <button type="submit" formAction={moveToReviewAction} className={styles.secondaryButton}>
          Move to Internal Review
        </button>
        <button type="submit" formAction={markReadyAction} className={styles.assignButton}>
          Mark Ready for Client
        </button>
      </div>
    </form>
  );
}
