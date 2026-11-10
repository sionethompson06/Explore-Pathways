import type { PlanningCallRecordDTO, PathwayOption, PlanningCallAttendance, PlanningCallOutcome } from "@/server/planning-call";
import { statusLabel } from "./format";
import styles from "./staff-page.module.css";

const ATTENDANCE_OPTIONS: PlanningCallAttendance[] = ["ATTENDED", "NO_SHOW", "CANCELLED", "RESCHEDULE_NEEDED"];
const OUTCOME_OPTIONS: PlanningCallOutcome[] = [
  "CONTINUE_TO_BLUEPRINT",
  "NEEDS_INFORMATION",
  "FOLLOW_UP",
  "NOT_CURRENT_SERVICE_FIT",
  "FAMILY_NOT_PROCEEDING",
];

/**
 * Phase 6D editable Planning Call Workspace form (sections 8-9, 21).
 * Structured, labeled sections -- never one blank notes field. One
 * plain `<form>` (no client JavaScript) with two submit buttons: "Save
 * Draft" posts to `saveDraftAction`, "Complete Planning Call" posts
 * the SAME field set to `completeAction` via its own `formAction`
 * (a native HTML mechanism -- one button in a form can target a
 * different server action than the form's own default). Only
 * rendered for the currently-assigned advisor; the detail pages
 * render PlanningCallSummary instead once the record is COMPLETED or
 * for an ADMIN viewer.
 */
export function PlanningCallForm({
  pathwaysCaseId,
  record,
  pathwayOptions,
  saveDraftAction,
  completeAction,
}: {
  pathwaysCaseId: string;
  record: PlanningCallRecordDTO | null;
  pathwayOptions: PathwayOption[];
  saveDraftAction: (formData: FormData) => Promise<void>;
  completeAction: (formData: FormData) => Promise<void>;
}) {
  const discussed = new Set(record?.pathwaysDiscussed ?? []);

  return (
    <form action={saveDraftAction} className={styles.planningForm}>
      <input type="hidden" name="pathwaysCaseId" value={pathwaysCaseId} />
      <input type="hidden" name="expectedVersion" value={record?.version ?? 0} />

      <section className={styles.section} aria-labelledby="goal-heading">
        <h2 id="goal-heading" className={styles.sectionTitle}>
          A. Family&apos;s Main Goal
        </h2>
        <p className={styles.provenanceNote}>Parent-reported, via advisor.</p>
        <label htmlFor="familyMainGoal" className={styles.visuallyHidden}>
          Family&apos;s main goal
        </label>
        <textarea
          id="familyMainGoal"
          name="familyMainGoal"
          rows={3}
          defaultValue={record?.familyMainGoal ?? ""}
          className={styles.textarea}
          placeholder="What does the family say they most want to accomplish?"
        />
        <label className={styles.checkboxOption}>
          <input type="checkbox" name="primaryGoalConfirmed" defaultChecked={record?.primaryGoalConfirmed ?? false} />
          Confirmed with the family during this call
        </label>
      </section>

      <section className={styles.section} aria-labelledby="situation-heading">
        <h2 id="situation-heading" className={styles.sectionTitle}>
          B. Current Educational Situation
        </h2>
        <p className={styles.provenanceNote}>Parent-reported, via advisor.</p>
        <label htmlFor="currentEducationalSituation" className={styles.visuallyHidden}>
          Current educational situation
        </label>
        <textarea
          id="currentEducationalSituation"
          name="currentEducationalSituation"
          rows={3}
          defaultValue={record?.currentEducationalSituation ?? ""}
          className={styles.textarea}
          placeholder="Current arrangement, and why the family is exploring alternatives/support."
        />
        <label className={styles.checkboxOption}>
          <input type="checkbox" name="currentModelConfirmed" defaultChecked={record?.currentModelConfirmed ?? false} />
          Confirmed with the family during this call
        </label>
      </section>

      <section className={styles.section} aria-labelledby="strengths-heading">
        <h2 id="strengths-heading" className={styles.sectionTitle}>
          C. Student Strengths &amp; Interests
        </h2>
        <p className={styles.provenanceNote}>Parent-reported, via advisor.</p>
        <label htmlFor="studentStrengths" className={styles.visuallyHidden}>
          Student strengths and interests
        </label>
        <textarea
          id="studentStrengths"
          name="studentStrengths"
          rows={3}
          defaultValue={record?.studentStrengths ?? ""}
          className={styles.textarea}
          placeholder="Strengths, motivations, interests, activities, aspirations -- not a psychometric judgment."
        />
      </section>

      <section className={styles.section} aria-labelledby="needs-heading">
        <h2 id="needs-heading" className={styles.sectionTitle}>
          D. Learning Needs &amp; Support
        </h2>
        <p className={styles.provenanceNote}>Parent-reported, via advisor.</p>
        <label htmlFor="learningNeedsSupport" className={styles.visuallyHidden}>
          Learning needs and support
        </label>
        <textarea
          id="learningNeedsSupport"
          name="learningNeedsSupport"
          rows={3}
          defaultValue={record?.learningNeedsSupport ?? ""}
          className={styles.textarea}
          placeholder="Academic support, structure, independence, pacing -- never a disability/clinical diagnosis."
        />
      </section>

      <section className={styles.section} aria-labelledby="lifestyle-heading">
        <h2 id="lifestyle-heading" className={styles.sectionTitle}>
          E. Schedule / Lifestyle Requirements
        </h2>
        <p className={styles.provenanceNote}>Parent-reported, via advisor.</p>
        <label htmlFor="scheduleLifestyleRequirements" className={styles.visuallyHidden}>
          Schedule and lifestyle requirements
        </label>
        <textarea
          id="scheduleLifestyleRequirements"
          name="scheduleLifestyleRequirements"
          rows={3}
          defaultValue={record?.scheduleLifestyleRequirements ?? ""}
          className={styles.textarea}
          placeholder="Athletics, performing arts, travel, work, family commitments."
        />
      </section>

      <section className={styles.section} aria-labelledby="academic-heading">
        <h2 id="academic-heading" className={styles.sectionTitle}>
          F. Academic Planning
        </h2>
        <p className={styles.provenanceNote}>Parent-reported, via advisor.</p>
        <label htmlFor="academicPlanningNotes" className={styles.visuallyHidden}>
          Academic planning notes
        </label>
        <textarea
          id="academicPlanningNotes"
          name="academicPlanningNotes"
          rows={3}
          defaultValue={record?.academicPlanningNotes ?? ""}
          className={styles.textarea}
          placeholder="Advancement, support, graduation planning, credit concerns, college prep, dual enrollment, CTE interest -- interest discussed is never a statement of eligibility."
        />
      </section>

      <section className={styles.section} aria-labelledby="pathways-heading">
        <h2 id="pathways-heading" className={styles.sectionTitle}>
          G. Pathway Discussion
        </h2>
        <p className={styles.provenanceNote}>
          Which existing Pathways educational directions were discussed with the family.
        </p>
        <div className={styles.checkboxGroup} role="group" aria-labelledby="pathways-heading">
          {pathwayOptions.map((opt) => (
            <label key={opt.id} className={styles.checkboxOption}>
              <input type="checkbox" name="pathwaysDiscussed" value={opt.id} defaultChecked={discussed.has(opt.id)} />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="unknowns-heading">
        <h2 id="unknowns-heading" className={styles.sectionTitle}>
          H. Important Unknowns
        </h2>
        <p className={styles.provenanceNote}>One item per line.</p>
        <label htmlFor="priorityQuestions">Open questions needing follow-up</label>
        <textarea
          id="priorityQuestions"
          name="priorityQuestions"
          rows={3}
          defaultValue={record?.priorityQuestions.join("\n") ?? ""}
          className={styles.textarea}
        />
        <label htmlFor="verifiedFacts">Verified information (confirmed by advisor)</label>
        <textarea
          id="verifiedFacts"
          name="verifiedFacts"
          rows={2}
          defaultValue={record?.verifiedFacts.join("\n") ?? ""}
          className={styles.textarea}
        />
        <label htmlFor="verificationNeeded">Needs verification (not yet confirmed)</label>
        <textarea
          id="verificationNeeded"
          name="verificationNeeded"
          rows={2}
          defaultValue={record?.verificationNeeded.join("\n") ?? ""}
          className={styles.textarea}
        />
      </section>

      <section className={styles.section} aria-labelledby="assessment-heading">
        <h2 id="assessment-heading" className={styles.sectionTitle}>
          I. Advisor Assessment
        </h2>
        <p className={styles.provenanceNote}>Advisor professional judgment -- not a parent statement.</p>
        <label htmlFor="advisorAssessment" className={styles.visuallyHidden}>
          Advisor assessment
        </label>
        <textarea
          id="advisorAssessment"
          name="advisorAssessment"
          rows={4}
          defaultValue={record?.advisorAssessment ?? ""}
          className={styles.textarea}
          placeholder="Concise professional interpretation of what appears worth exploring next."
        />
        <label htmlFor="serviceFit">Service fit (advisor judgment)</label>
        <select id="serviceFit" name="serviceFit" defaultValue={record?.serviceFit ?? ""}>
          <option value="">Not yet determined</option>
          <option value="GOOD_FIT">Good fit</option>
          <option value="POSSIBLE_FIT">Possible fit</option>
          <option value="NOT_CURRENT_FIT">Not a current fit</option>
          <option value="UNDETERMINED">Undetermined</option>
        </select>
        <label className={styles.checkboxOption}>
          <input type="checkbox" name="followUpRequired" defaultChecked={record?.followUpRequired ?? false} />
          A follow-up conversation is required
        </label>
      </section>

      <section className={styles.section} aria-labelledby="next-heading">
        <h2 id="next-heading" className={styles.sectionTitle}>
          J. Recommended Next Step
        </h2>
        <p className={styles.provenanceNote}>Advisor professional judgment.</p>
        <label htmlFor="recommendedNextAction" className={styles.visuallyHidden}>
          Recommended next step
        </label>
        <textarea
          id="recommendedNextAction"
          name="recommendedNextAction"
          rows={3}
          defaultValue={record?.recommendedNextAction ?? ""}
          className={styles.textarea}
          placeholder="What should Pathways do next?"
        />
      </section>

      <section className={styles.section} aria-labelledby="outcome-heading">
        <h2 id="outcome-heading" className={styles.sectionTitle}>
          Outcome
        </h2>
        <fieldset className={styles.radioGroup}>
          <legend>Consultation attendance</legend>
          {ATTENDANCE_OPTIONS.map((value) => (
            <label key={value} className={styles.radioOption}>
              <input type="radio" name="attendance" value={value} defaultChecked={record?.attendance === value} />
              {statusLabel(value)}
            </label>
          ))}
        </fieldset>
        <fieldset className={styles.radioGroup}>
          <legend>Recommended next operational step</legend>
          {OUTCOME_OPTIONS.map((value) => (
            <label key={value} className={styles.radioOption}>
              <input type="radio" name="outcome" value={value} defaultChecked={record?.outcome === value} />
              {statusLabel(value)}
            </label>
          ))}
        </fieldset>
        <p className={styles.provenanceNote}>
          &quot;Continue to Blueprint&quot; is only accepted when attendance is &quot;Attended&quot; -- it is an
          internal operational routing decision only, never an academic-eligibility, acceptance, or payment claim.
        </p>
      </section>

      <div className={styles.saveControls}>
        <button type="submit" className={styles.secondaryButton}>
          Save Draft
        </button>
        <button type="submit" formAction={completeAction} className={styles.assignButton}>
          Complete Planning Call
        </button>
      </div>
    </form>
  );
}
