const STATUS_CLASS = {
  draft:        "badge-draft",
  open:         "badge-open",
  under_review: "badge-pending",
  awarded:      "badge-awarded",
  assigned:     "badge-awarded",
  in_transit:   "badge-in_transit",
  delivered:    "badge-delivered",
  cancelled:    "badge-cancelled",
  expired:      "badge-expired",
  // bid statuses
  active:       "badge-open",
  won:          "badge-delivered",
  lost:         "badge-cancelled",
  withdrawn:    "badge-cancelled",
  countered:    "badge-pending",
  // kyc
  pending:      "badge-pending",
  approved:     "badge-approved",
  rejected:     "badge-rejected",
};

const LABELS = {
  draft:        "Draft",
  open:         "Open",
  under_review: "Under Review",
  awarded:      "Awarded",
  assigned:     "Assigned",
  in_transit:   "In Transit",
  delivered:    "Delivered",
  cancelled:    "Cancelled",
  expired:      "Expired",
  active:       "Active",
  won:          "Won",
  lost:         "Lost",
  withdrawn:    "Withdrawn",
  countered:    "Countered",
  pending:      "Pending",
  approved:     "Approved",
  rejected:     "Rejected",
};

export default function LoadStatusBadge({ status }) {
  const cls = STATUS_CLASS[status] ?? "badge-draft";
  return <span className={cls}>{LABELS[status] ?? status}</span>;
}
