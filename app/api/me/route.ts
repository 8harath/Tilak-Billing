import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/server/authz';

export async function GET() {
  try {
    const authorization = await authorizeRequest();
    if ('response' in authorization) {
      return authorization.response;
    }

    const { user, profile } = authorization;

    return NextResponse.json({
      id: user.id,
      email: user.email || null,
      name: profile.name,
      role: profile.role,
      schoolId: profile.school_id,
      isActive: profile.is_active,
    });
  } catch (error) {
    console.error('Me API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
