import type { LifeEvent } from "../core/events.ts";
import { CHILDHOOD } from "./events/childhood.ts";
import { SCHOOL } from "./events/school.ts";
import { TEEN } from "./events/teen.ts";
import { YOUTH } from "./events/youth.ts";
import { ADULT } from "./events/adult.ts";
import { SENIOR } from "./events/senior.ts";
import { crisisEvents } from "./crises.ts";

export const EVENTS: LifeEvent[] = [
  ...CHILDHOOD, ...SCHOOL, ...TEEN, ...YOUTH, ...ADULT, ...SENIOR, ...crisisEvents(),
];
