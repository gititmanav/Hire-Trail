import type { EventInput } from "@fullcalendar/core";
import type { Application, Company, Contact, Deadline, Resume } from "../types";

type CalendarSource = "applications" | "deadlines" | "contacts" | "resumes" | "companies";

export interface CalendarExtendedProps {
  source: CalendarSource;
  route: string;
  entityId: string;
  subtitle?: string;
}

interface BuildCalendarEventsParams {
  applications: Application[];
  deadlines: Deadline[];
  contacts: Contact[];
  resumes: Resume[];
  companies: Company[];
}

const isoDay = (value: string) => value.slice(0, 10);

export function buildCalendarEvents({
  applications,
  deadlines,
  contacts,
  resumes,
  companies,
}: BuildCalendarEventsParams): EventInput[] {
  const events: EventInput[] = [];

  for (const app of applications) {
    events.push({
      id: `app-${app._id}`,
      title: `${app.company} - ${app.role}`,
      start: isoDay(app.applicationDate),
      allDay: true,
      backgroundColor: "#2563eb",
      borderColor: "#2563eb",
      extendedProps: {
        source: "applications",
        route: "/applications",
        entityId: app._id,
        subtitle: `Stage: ${app.stage}`,
      } satisfies CalendarExtendedProps,
    });
  }

  for (const deadline of deadlines) {
    events.push({
      id: `deadline-${deadline._id}`,
      title: deadline.type,
      start: isoDay(deadline.dueDate),
      allDay: true,
      backgroundColor: deadline.completed ? "#10b981" : "#f59e0b",
      borderColor: deadline.completed ? "#10b981" : "#f59e0b",
      extendedProps: {
        source: "deadlines",
        route: "/deadlines",
        entityId: deadline._id,
        subtitle: deadline.completed ? "Completed" : "Due",
      } satisfies CalendarExtendedProps,
    });
  }

  for (const contact of contacts) {
    if (contact.nextFollowUpDate) {
      events.push({
        id: `contact-followup-${contact._id}`,
        title: `Follow up with ${contact.name}`,
        start: isoDay(contact.nextFollowUpDate),
        allDay: true,
        backgroundColor: "#8b5cf6",
        borderColor: "#8b5cf6",
        extendedProps: {
          source: "contacts",
          route: "/contacts",
          entityId: contact._id,
          subtitle: contact.company,
        } satisfies CalendarExtendedProps,
      });
    }
  }

  for (const resume of resumes) {
    events.push({
      id: `resume-${resume._id}`,
      title: `Resume uploaded: ${resume.name}`,
      start: isoDay(resume.uploadDate),
      allDay: true,
      backgroundColor: "#14b8a6",
      borderColor: "#14b8a6",
      extendedProps: {
        source: "resumes",
        route: "/resumes",
        entityId: resume._id,
        subtitle: resume.targetRole,
      } satisfies CalendarExtendedProps,
    });
  }

  for (const company of companies) {
    events.push({
      id: `company-${company._id}`,
      title: `Company added: ${company.name}`,
      start: isoDay(company.createdAt),
      allDay: true,
      backgroundColor: "#64748b",
      borderColor: "#64748b",
      extendedProps: {
        source: "companies",
        route: "/companies",
        entityId: company._id,
      } satisfies CalendarExtendedProps,
    });
  }

  return events;
}
