import type { BlueprintRevisionDTO } from "@/server/blueprint";
import type { TaxonomyOption } from "@/server/blueprint";
import { formatStaffDateTime, statusLabel } from "./format";
import styles from "./staff-page.module.css";

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className={styles.detailField}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ProvenanceTag({ value }: { value: string }) {
  return <p className={styles.provenanceNote}>Source: {statusLabel(value)}</p>;
}

function labelFor(options: readonly TaxonomyOption[], id: string): string {
  return options.find((o) => o.id === id)?.label ?? id;
}

/**
 * Phase 6E internal document-style read-only preview (section 29,
 * section 39 professional-scope statement). Used by the advisor's own
 * non-editable states (INTERNAL_REVIEW alongside the form is still
 * editable -- this is shown once READY_FOR_CLIENT/SUPERSEDED/ARCHIVED)
 * and by the admin read-only view -- never renders an editable
 * control.
 */
export function BlueprintPreview({
  revision,
  baseModelOptions,
  overlayOptions,
  supportOptions,
  opportunityOptions,
}: {
  revision: BlueprintRevisionDTO;
  baseModelOptions: TaxonomyOption[];
  overlayOptions: TaxonomyOption[];
  supportOptions: TaxonomyOption[];
  opportunityOptions: TaxonomyOption[];
}) {
  const { content } = revision;
  const b06Included = content.b06.considerations;
  const b07Included = content.b07.items;
  const b08Included = content.b08.items;

  return (
    <section className={styles.section} aria-labelledby="blueprint-preview-heading">
      <h2 id="blueprint-preview-heading" className={styles.sectionTitle}>
        Student Success Blueprint -- Revision {revision.revisionNumber}
      </h2>
      <dl className={styles.detailGrid}>
        <div className={styles.detailField}>
          <dt>Status</dt>
          <dd>
            <span className={styles.badge} data-status={revision.status}>
              {statusLabel(revision.status)}
            </span>
          </dd>
        </div>
        <div className={styles.detailField}>
          <dt>Last updated</dt>
          <dd>{formatStaffDateTime(revision.updatedAt)}</dd>
        </div>
        {revision.readyForClientAt ? (
          <div className={styles.detailField}>
            <dt>Ready for client</dt>
            <dd>{formatStaffDateTime(revision.readyForClientAt)}</dd>
          </div>
        ) : null}
        {revision.revisionReason ? (
          <div className={styles.detailField}>
            <dt>Revision reason</dt>
            <dd>{statusLabel(revision.revisionReason)}</dd>
          </div>
        ) : null}
      </dl>

      <h3 className={styles.sectionTitle}>B01. Student Snapshot</h3>
      <ProvenanceTag value={content.b01.provenance} />
      <Field label="Student display name" value={content.b01.studentDisplayName} />
      <Field label="Grade" value={content.b01.grade} />
      <Field label="Grade band" value={content.b01.gradeBand} />
      <Field label="Current educational context" value={content.b01.currentEducationalContext} />
      <Field label="Stated goals" value={content.b01.statedGoals} />
      <Field label="Strengths and interests" value={content.b01.strengthsInterests} />
      <Field label="Important learning context" value={content.b01.importantLearningContext} />
      <Field label="Schedule / lifestyle factors" value={content.b01.scheduleLifestyleFactors} />

      <h3 className={styles.sectionTitle}>B02. Family Goals &amp; Priorities</h3>
      <ProvenanceTag value={content.b02.provenance} />
      <Field label="Reason for seeking Pathways" value={content.b02.reasonForSeekingPathways} />
      <Field label="Confirmed primary goal" value={content.b02.confirmedPrimaryGoal} />
      {content.b02.majorPriorities.length > 0 ? (
        <div className={styles.detailField}>
          <dt>Major priorities</dt>
          <dd>
            <ul>
              {content.b02.majorPriorities.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
      <Field label="Desired change" value={content.b02.desiredChange} />
      {content.b02.nonNegotiables.length > 0 ? (
        <div className={styles.detailField}>
          <dt>Non-negotiables</dt>
          <dd>
            <ul>
              {content.b02.nonNegotiables.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
      <Field label="Longer-term aspirations" value={content.b02.longerTermAspirations} />

      <h3 className={styles.sectionTitle}>B03. Current Educational Situation</h3>
      <ProvenanceTag value={content.b03.provenance} />
      <Field label="Current arrangement" value={content.b03.currentArrangement} />
      <Field label="What is working" value={content.b03.whatIsWorking} />
      <Field label="What the family wants to change" value={content.b03.whatFamilyWantsToChange} />
      <Field label="Academic concerns" value={content.b03.academicConcerns} />
      <Field label="Support context" value={content.b03.supportContext} />
      <Field label="Operational constraints" value={content.b03.operationalConstraints} />
      {content.b03.unresolvedFacts.length > 0 ? (
        <div className={styles.detailField}>
          <dt>Unresolved facts</dt>
          <dd>
            <ul>
              {content.b03.unresolvedFacts.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}

      <h3 className={styles.sectionTitle}>B04. Recommended Educational Strategy</h3>
      <ProvenanceTag value={content.b04.provenance} />
      {content.b04.recommendedModelIds.length > 0 ? (
        <ul className={styles.chipList}>
          {content.b04.recommendedModelIds.map((id) => (
            <li key={id} className={styles.chip}>
              {labelFor(baseModelOptions, id)}
            </li>
          ))}
        </ul>
      ) : null}
      {content.b04.overlayIds.length > 0 ? (
        <ul className={styles.chipList}>
          {content.b04.overlayIds.map((id) => (
            <li key={id} className={styles.chip}>
              {labelFor(overlayOptions, id)}
            </li>
          ))}
        </ul>
      ) : null}
      <Field label="Support approach" value={content.b04.supportApproach} />
      <Field label="Alignment rationale" value={content.b04.alignmentRationale} />
      <Field label="Tradeoffs" value={content.b04.tradeoffs} />
      <Field label="Risks / considerations" value={content.b04.risksConsiderations} />
      <Field label="Conditions requiring verification" value={content.b04.conditionsRequiringVerification} />

      <h3 className={styles.sectionTitle}>B05. Academic Planning</h3>
      <ProvenanceTag value={content.b05.provenance} />
      {content.b05.domains.length > 0 ? (
        <ul className={styles.chipList}>
          {content.b05.domains.map((d) => (
            <li key={d} className={styles.chip}>
              {statusLabel(d)}
            </li>
          ))}
        </ul>
      ) : null}
      <Field label="Narrative" value={content.b05.narrative} />

      <h3 className={styles.sectionTitle}>B06. Schedule &amp; Lifestyle Plan</h3>
      <ProvenanceTag value={content.b06.provenance} />
      {b06Included.length > 0 ? (
        <ul>
          {b06Included.map((c, i) => (
            <li key={i}>
              {statusLabel(c.factor)}
              {c.notes ? ` -- ${c.notes}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      <Field label="Narrative" value={content.b06.narrative} />

      <h3 className={styles.sectionTitle}>B07. Opportunities to Explore</h3>
      {b07Included.length > 0 ? (
        <ul>
          {b07Included.map((i) => (
            <li key={i.id}>
              {labelFor(opportunityOptions, i.opportunityId)} -- {statusLabel(i.horizon)}
              {i.notes ? ` -- ${i.notes}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyState}>No opportunities recorded.</p>
      )}

      <h3 className={styles.sectionTitle}>B08. Support Plan</h3>
      {b08Included.length > 0 ? (
        <ul>
          {b08Included.map((i) => (
            <li key={i.id}>
              {labelFor(supportOptions, i.supportId)} -- {statusLabel(i.framing)}
              {i.notes ? ` -- ${i.notes}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyState}>No supports recorded.</p>
      )}

      <h3 className={styles.sectionTitle}>B09. Verification Items</h3>
      {content.b09.items.length > 0 ? (
        <ul>
          {content.b09.items.map((i) => (
            <li key={i.id}>
              [{statusLabel(i.status)}] {statusLabel(i.category)}: {i.question}
              {i.owner ? ` (owner: ${i.owner})` : ""}
              {i.verifiedAt ? ` -- verified ${formatStaffDateTime(i.verifiedAt)}${i.verifiedBy ? ` by ${i.verifiedBy}` : ""}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyState}>No verification items recorded.</p>
      )}

      <h3 className={styles.sectionTitle}>B10. Action Plan</h3>
      {content.b10.items.length > 0 ? (
        <ul>
          {content.b10.items.map((i) => (
            <li key={i.id}>
              [{statusLabel(i.status)}] {i.text} ({statusLabel(i.owner)}
              {i.timing ? `, ${i.timing}` : ""})
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyState}>No action items recorded.</p>
      )}

      <h3 className={styles.sectionTitle}>B11. 30 / 60 / 90-Day Roadmap</h3>
      {(["days0to30", "days31to60", "days61to90"] as const).map((bucket) => (
        <div key={bucket} className={styles.detailField}>
          <dt>{bucket === "days0to30" ? "First 30 days" : bucket === "days31to60" ? "Days 31-60" : "Days 61-90"}</dt>
          <dd>
            {content.b11[bucket].length > 0 ? (
              <ul>
                {content.b11[bucket].map((i) => (
                  <li key={i.id}>
                    [{statusLabel(i.status)}] {i.text}
                  </li>
                ))}
              </ul>
            ) : (
              "—"
            )}
          </dd>
        </div>
      ))}

      <h3 className={styles.sectionTitle}>B12. Advisor Professional Summary</h3>
      <Field label="Summary" value={content.b12.summary} />

      <p className={styles.provenanceNote}>
        This Student Success Blueprint reflects Pathways&apos; professional educational planning guidance based on
        information available at the time it was authored. It is not a guarantee of enrollment, acceptance, academic
        outcome, or any third-party approval, and nothing in it constitutes legal, medical, or financial advice.
      </p>
    </section>
  );
}
