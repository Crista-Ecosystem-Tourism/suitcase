import { apiGet, apiPost } from './api';

export interface TripMember {
    user_id: string;
    role: 'owner' | 'member';
    joined_at: string;
}

export interface SplitSummary {
    currencies: Array<{
        currency: string;
        balances: Array<{ user_id: string; amount: string }>;
        suggested_settlements: Array<{ from_user_id: string; to_user_id: string; amount: string }>;
    }>;
}

export interface TripInvite {
    id: string;
    invite_code: string;
    expires_at: string;
}

export function getTripMembers(tripId: string): Promise<TripMember[]> {
    return apiGet(`/suitcase/trips/${tripId}/members`);
}

export function getTripSplitSummary(tripId: string): Promise<SplitSummary> {
    return apiGet(`/suitcase/trips/${tripId}/split-summary`);
}

export function createTripInvite(tripId: string): Promise<TripInvite> {
    return apiPost(`/suitcase/trips/${tripId}/member-invites`);
}

export function acceptTripInvite(inviteCode: string): Promise<{ trip_id: string; created: boolean }> {
    return apiPost('/suitcase/member-invites/accept', { invite_code: inviteCode.trim() });
}

export function settleTripDebt(tripId: string, toUserId: string, amount: string, currency: string): Promise<void> {
    return apiPost(`/suitcase/trips/${tripId}/settlements`, {
        to_user_id: toUserId,
        amount,
        currency,
    });
}
