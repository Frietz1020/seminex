import { jsPDF } from 'jspdf';
import type { Profile, Registration, Seminar, Ticket } from './types';

export interface TicketPdfInput {
  seminar: Seminar;
  ticket: Ticket;
  profile: Profile;
  registration: Registration;
}
/**
 * Build a one-page ticket PDF from the signed-in student's ticket data.
 *
 * @param input Seminar, caller-owned ticket and profile, and active registration data.
 * @returns A browser PDF Blob. Attendance scanning uses a short-lived QR shown in the app;
 * printed PDFs intentionally contain no scan code.
 */
export async function createTicketPdf(input: TicketPdfInput): Promise<Blob> {
  const fullName = [
    input.profile.firstName,
    input.profile.middleInitial ? `${input.profile.middleInitial}.` : '',
    input.profile.lastName,
  ].filter(Boolean).join(' ');
  const startsAt = new Date(input.seminar.startsAt);
  const endsAt = new Date(input.seminar.endsAt);
  const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(startsAt);
  const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const timeRange = `${clock.format(startsAt)}–${clock.format(endsAt)}`;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: false });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Seminex admission ticket', 18, 15);
  doc.setFontSize(20);
  doc.text(input.seminar.title, 18, 28, { maxWidth: 174 });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(`Applicant: ${fullName}`, 18, 48, { maxWidth: 174 });
  doc.text(`Student ID: ${input.ticket.studentId}`, 18, 58);
  doc.text(`Registration: ${input.registration.reference}`, 18, 68);
  doc.setFontSize(11);
  doc.text('Show the live attendance QR in the Seminex app to record attendance.', 18, 100, { maxWidth: 174 });
  doc.setFontSize(11);
  doc.text(`Date: ${date}`, 18, 158);
  doc.text(`Time: ${timeRange}`, 18, 168);
  doc.text(`Venue: ${input.seminar.venue}`, 18, 178, { maxWidth: 174 });
  return doc.output('blob');
}

/** Return a safe, stable filename for a seminar ticket PDF. */
export function ticketPdfFilename(reference: string): string {
  const safeReference = reference
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^[ .]+|[ .]+$/g, '');
  return `seminex-${safeReference || 'ticket'}-ticket.pdf`;
}
