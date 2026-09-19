import ICAL from 'ical.js';

const SINGAPORE_ZONE = `BEGIN:VTIMEZONE\r\nTZID:Asia/Singapore\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0800\r\nTZOFFSETTO:+0800\r\nTZNAME:SGT\r\nEND:STANDARD\r\nEND:VTIMEZONE`;
function milliseconds(time) {
  if (time.zone.tzid === 'floating') return Date.UTC(time.year,time.month-1,time.day,time.hour,time.minute,time.second) - 8*3600000;
  return time.toUnixTime()*1000;
}
export function upcomingEvents(text, now = Date.now()) {
  if (text.length > 2_000_000) throw new Error('Choose a calendar smaller than 2 MB.');
  if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) throw new Error('Choose a valid .ics or .ical calendar file.');
  ICAL.TimezoneService.reset();
  const sg = new ICAL.Component(ICAL.parse(SINGAPORE_ZONE));
  ICAL.TimezoneService.register(new ICAL.Timezone({ component: sg, tzid: 'Asia/Singapore' }));
  const calendar = new ICAL.Component(ICAL.parse(text));
  calendar.getAllSubcomponents('vtimezone').forEach(component => {
    ICAL.TimezoneService.register(new ICAL.Timezone({ component, tzid: component.getFirstPropertyValue('tzid') }));
  });
  const components = calendar.getAllSubcomponents('vevent');
  if (components.length > 1500) throw new Error('Export a smaller calendar (up to 1,500 events).');
  const horizon = now + 90*86400000, output = [], warnings = new Set();
  let steps = 0;
  const add = (event, start) => {
    if (!start || event.component.getFirstPropertyValue('status') === 'CANCELLED') return;
    if (start.isDate) { warnings.add('All-day events need a time before a departure can be calculated.'); return; }
    const at = milliseconds(start);
    if (at >= now && at <= horizon) output.push({ id: `${event.uid}:${at}`, title: event.summary || 'Untitled event', location: event.location || '', start: new Date(at).toISOString() });
  };
  for (const component of components) {
    const uid = component.getFirstPropertyValue('uid');
    const tzid = component.getFirstProperty('dtstart')?.getParameter('tzid');
    if (tzid && !ICAL.TimezoneService.has(tzid)) { warnings.add(`Skipped unsupported timezone ${String(tzid).slice(0,80)}; re-export with VTIMEZONE or UTC.`); continue; }
    if (component.getFirstPropertyValue('status') === 'CANCELLED' || !component.hasProperty('dtstart')) continue;
    if(component.hasProperty('recurrence-id')) {
      if(!components.some(c=>!c.hasProperty('recurrence-id') && c.getFirstPropertyValue('uid')===uid)) {
        const single=new ICAL.Event(component);add(single,single.startDate);
      }
      continue;
    }
    const exceptions = components.filter(c => c.hasProperty('recurrence-id') && c.getFirstPropertyValue('uid') === uid);
    const event = new ICAL.Event(component, { exceptions, strictExceptions: true });
    if (!event.isRecurring()) { add(event,event.startDate); continue; }
    const iterator = event.iterator();
    let occurrence;
    while ((occurrence = iterator.next())) {
      if (++steps > 25000) throw new Error('Calendar recurrence is too complex. Export only the next few months.');
      if (milliseconds(occurrence) > horizon) break;
      const details = event.getOccurrenceDetails(occurrence);
      add(details.item,details.startDate);
    }
    // A moved exception may be in range even when its original occurrence is beyond the horizon.
    exceptions.forEach(c => { const e = new ICAL.Event(c); add(e,e.startDate); });
  }
  const unique = [...new Map(output.map(e => [e.id,e])).values()].sort((a,b) => Date.parse(a.start)-Date.parse(b.start));
  return { events: unique.slice(0,20), warnings: [...warnings] };
}
