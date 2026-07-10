import { currentSession } from '@/lib/session';
import { UserSettingsForm, WorkspaceSettingsForm } from './settings-forms';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { workspace, user } = await currentSession();
  const notifyOnQueue = user.settings['notifyOnQueue'] === true;

  return (
    <main>
      <header className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Fund settings apply to everyone in {workspace.fundName}; your settings apply only to {user.email}.
        </p>
      </header>
      <WorkspaceSettingsForm fundName={workspace.fundName} intakeSlug={workspace.intakeSlug} />
      <UserSettingsForm notifyOnQueue={notifyOnQueue} />
    </main>
  );
}
