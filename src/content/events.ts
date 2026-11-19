import type { LifeEvent } from "../core/events.ts";
import { CHILDHOOD } from "./events/childhood.ts";
import { SCHOOL } from "./events/school.ts";
import { TEEN } from "./events/teen.ts";
import { YOUTH } from "./events/youth.ts";
import { ADULT } from "./events/adult.ts";
import { SENIOR } from "./events/senior.ts";
import { crisisEvents } from "./crises.ts";
import { FAMILY_EVENTS } from "./family-events.ts";
import { CONFLICT_EVENTS } from "./conflict-events.ts";
import { LINEAGE_EVENTS } from "./lineage-events.ts";
import { LOCAL_EVENTS } from "./local-events.ts";

export const EVENTS: LifeEvent[] = [
  ...CHILDHOOD, ...SCHOOL, ...TEEN, ...YOUTH, ...ADULT, ...SENIOR, ...crisisEvents(), ...LINEAGE_EVENTS, ...LOCAL_EVENTS,
];

export const ALL_EVENTS: LifeEvent[] = [...EVENTS, ...FAMILY_EVENTS, ...CONFLICT_EVENTS];
