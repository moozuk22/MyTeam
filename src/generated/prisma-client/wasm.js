
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  detectRuntime,
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.10.2
 * Query Engine version: 5a9203d0590c951969e85a7d07215503f4672eb9
 */
Prisma.prismaVersion = {
  client: "5.10.2",
  engine: "5a9203d0590c951969e85a7d07215503f4672eb9"
}

Prisma.PrismaClientKnownRequestError = () => {
  throw new Error(`PrismaClientKnownRequestError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  throw new Error(`PrismaClientUnknownRequestError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  throw new Error(`PrismaClientRustPanicError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  throw new Error(`PrismaClientInitializationError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  throw new Error(`PrismaClientValidationError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  throw new Error(`NotFoundError is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  throw new Error(`sqltag is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  throw new Error(`empty is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  throw new Error(`join is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  throw new Error(`raw is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  throw new Error(`Extensions.getExtensionContext is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  throw new Error(`Extensions.defineExtension is unable to be run ${runtimeDescription}.
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}

/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.ClubScalarFieldEnum = {
  id: 'id',
  name: 'name',
  createdAt: 'createdAt',
  emblemUrl: 'emblemUrl',
  imagePublicId: 'imagePublicId',
  imageUrl: 'imageUrl',
  reminderDay: 'reminderDay',
  overdueDay: 'overdueDay',
  reminderHour: 'reminderHour',
  reminderTz: 'reminderTz',
  trainingWeekdays: 'trainingWeekdays',
  trainingWindowDays: 'trainingWindowDays',
  trainingDates: 'trainingDates',
  reminderMinute: 'reminderMinute',
  overdueHour: 'overdueHour',
  overdueMinute: 'overdueMinute',
  sports: 'sports',
  trainingTime: 'trainingTime',
  trainingDateTimes: 'trainingDateTimes',
  secondReminderDay: 'secondReminderDay',
  secondReminderHour: 'secondReminderHour',
  secondReminderMinute: 'secondReminderMinute',
  notifyOnCoachVisit: 'notifyOnCoachVisit',
  trainingGroupMode: 'trainingGroupMode'
};

exports.Prisma.AdminPushSubscriptionScalarFieldEnum = {
  id: 'id',
  clubId: 'clubId',
  endpoint: 'endpoint',
  p256dh: 'p256dh',
  auth: 'auth',
  userAgent: 'userAgent',
  device: 'device',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  coach_group_id: 'coach_group_id'
};

exports.Prisma.ClubTrainingGroupScheduleScalarFieldEnum = {
  id: 'id',
  clubId: 'clubId',
  teamGroup: 'teamGroup',
  trainingWeekdays: 'trainingWeekdays',
  trainingDates: 'trainingDates',
  trainingWindowDays: 'trainingWindowDays',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  trainingTime: 'trainingTime',
  trainingDateTimes: 'trainingDateTimes'
};

exports.Prisma.ClubTrainingScheduleGroupScalarFieldEnum = {
  id: 'id',
  clubId: 'clubId',
  name: 'name',
  teamGroups: 'teamGroups',
  trainingWeekdays: 'trainingWeekdays',
  trainingDates: 'trainingDates',
  trainingWindowDays: 'trainingWindowDays',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  trainingTime: 'trainingTime',
  trainingDateTimes: 'trainingDateTimes'
};

exports.Prisma.ClubCustomTrainingGroupScalarFieldEnum = {
  id: 'id',
  clubId: 'clubId',
  name: 'name',
  trainingWeekdays: 'trainingWeekdays',
  trainingDates: 'trainingDates',
  trainingTime: 'trainingTime',
  trainingDateTimes: 'trainingDateTimes',
  trainingWindowDays: 'trainingWindowDays',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  password: 'password',
  roles: 'roles',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlayerScalarFieldEnum = {
  id: 'id',
  clubId: 'clubId',
  fullName: 'fullName',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  jerseyNumber: 'jerseyNumber',
  birthDate: 'birthDate',
  teamGroup: 'teamGroup',
  lastPaymentDate: 'lastPaymentDate',
  isActive: 'isActive',
  coach_group_id: 'coach_group_id'
};

exports.Prisma.ClubCustomTrainingGroupPlayerScalarFieldEnum = {
  groupId: 'groupId',
  playerId: 'playerId',
  createdAt: 'createdAt'
};

exports.Prisma.TrainingOptOutScalarFieldEnum = {
  id: 'id',
  playerId: 'playerId',
  trainingDate: 'trainingDate',
  createdAt: 'createdAt',
  reasonCode: 'reasonCode',
  reasonText: 'reasonText'
};

exports.Prisma.TrainingNoteScalarFieldEnum = {
  id: 'id',
  clubId: 'clubId',
  trainingDate: 'trainingDate',
  note: 'note',
  createdByUserId: 'createdByUserId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ImageScalarFieldEnum = {
  id: 'id',
  playerId: 'playerId',
  imageUrl: 'imageUrl',
  isAdminView: 'isAdminView'
};

exports.Prisma.PaymentLogScalarFieldEnum = {
  id: 'id',
  playerId: 'playerId',
  paidAt: 'paidAt',
  recordedBy: 'recordedBy',
  paidFor: 'paidFor'
};

exports.Prisma.PaymentWaiverScalarFieldEnum = {
  id: 'id',
  playerId: 'playerId',
  waivedFor: 'waivedFor',
  reason: 'reason',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PushSubscriptionScalarFieldEnum = {
  id: 'id',
  playerId: 'playerId',
  endpoint: 'endpoint',
  p256dh: 'p256dh',
  auth: 'auth',
  userAgent: 'userAgent',
  device: 'device',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PlayerNotificationScalarFieldEnum = {
  id: 'id',
  playerId: 'playerId',
  type: 'type',
  title: 'title',
  body: 'body',
  url: 'url',
  sentAt: 'sentAt',
  readAt: 'readAt'
};

exports.Prisma.AdminNotificationScalarFieldEnum = {
  id: 'id',
  clubId: 'clubId',
  playerId: 'playerId',
  type: 'type',
  title: 'title',
  body: 'body',
  url: 'url',
  sentAt: 'sentAt',
  readAt: 'readAt'
};

exports.Prisma.CardScalarFieldEnum = {
  id: 'id',
  cardCode: 'cardCode',
  playerId: 'playerId',
  isActive: 'isActive',
  createdAt: 'createdAt'
};

exports.Prisma.CronJobRunScalarFieldEnum = {
  id: 'id',
  jobName: 'jobName',
  runYear: 'runYear',
  runMonth: 'runMonth',
  completedAt: 'completedAt',
  createdAt: 'createdAt',
  failedAt: 'failedAt',
  errorMessage: 'errorMessage'
};

exports.Prisma.PartnerDiscountUsageScalarFieldEnum = {
  id: 'id',
  playerId: 'playerId',
  partner: 'partner',
  action: 'action',
  date: 'date',
  createdAt: 'createdAt'
};

exports.Prisma.PageClickScalarFieldEnum = {
  id: 'id',
  clickedAt: 'clickedAt',
  action: 'action'
};

exports.Prisma.PartnerDiscountScalarFieldEnum = {
  id: 'id',
  name: 'name',
  logoUrl: 'logoUrl',
  badgeText: 'badgeText',
  description: 'description',
  code: 'code',
  validUntil: 'validUntil',
  storeUrl: 'storeUrl',
  terms: 'terms',
  themeColor: 'themeColor',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TeamDiscountConfigScalarFieldEnum = {
  id: 'id',
  clubId: 'clubId',
  teamGroup: 'teamGroup',
  discountId: 'discountId',
  order: 'order',
  isVisible: 'isVisible'
};

exports.Prisma.Coach_groupsScalarFieldEnum = {
  id: 'id',
  club_id: 'club_id',
  name: 'name',
  created_at: 'created_at',
  updated_at: 'updated_at'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.UserRole = exports.$Enums.UserRole = {
  admin: 'admin',
  coach: 'coach'
};

exports.PlayerStatus = exports.$Enums.PlayerStatus = {
  paid: 'paid',
  warning: 'warning',
  overdue: 'overdue'
};

exports.Prisma.ModelName = {
  Club: 'Club',
  AdminPushSubscription: 'AdminPushSubscription',
  ClubTrainingGroupSchedule: 'ClubTrainingGroupSchedule',
  ClubTrainingScheduleGroup: 'ClubTrainingScheduleGroup',
  ClubCustomTrainingGroup: 'ClubCustomTrainingGroup',
  User: 'User',
  Player: 'Player',
  ClubCustomTrainingGroupPlayer: 'ClubCustomTrainingGroupPlayer',
  TrainingOptOut: 'TrainingOptOut',
  TrainingNote: 'TrainingNote',
  Image: 'Image',
  PaymentLog: 'PaymentLog',
  PaymentWaiver: 'PaymentWaiver',
  PushSubscription: 'PushSubscription',
  PlayerNotification: 'PlayerNotification',
  AdminNotification: 'AdminNotification',
  Card: 'Card',
  CronJobRun: 'CronJobRun',
  PartnerDiscountUsage: 'PartnerDiscountUsage',
  PageClick: 'PageClick',
  PartnerDiscount: 'PartnerDiscount',
  TeamDiscountConfig: 'TeamDiscountConfig',
  coach_groups: 'coach_groups'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        const runtime = detectRuntime()
        const edgeRuntimeName = {
          'workerd': 'Cloudflare Workers',
          'deno': 'Deno and Deno Deploy',
          'netlify': 'Netlify Edge Functions',
          'edge-light': 'Vercel Edge Functions or Edge Middleware',
        }[runtime]

        let message = 'PrismaClient is unable to run in '
        if (edgeRuntimeName !== undefined) {
          message += edgeRuntimeName + '. As an alternative, try Accelerate: https://pris.ly/d/accelerate.'
        } else {
          message += 'this browser environment, or has been bundled for the browser (running in `' + runtime + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
