import { addDays } from 'date-fns';

export class CanadaPadPolicy {
  constructor(private readonly noticeDays = 10) {}

  applyVariablePadPolicy(params: {
    country: 'US' | 'CA' | 'RW';
    padWaiverActive: boolean;
    variableAmount: boolean;
  }) {
    if (params.country !== 'CA' || !params.variableAmount || params.padWaiverActive) {
      return { scheduleAt: null, requiresPreNotification: false };
    }

    return {
      scheduleAt: addDays(new Date(), this.noticeDays),
      requiresPreNotification: true,
    };
  }
}
