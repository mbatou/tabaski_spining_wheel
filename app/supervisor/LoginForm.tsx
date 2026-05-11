export function LoginForm({ error }: { error: boolean }) {
  return (
    <div className="sup-login-wrap">
      <form className="sup-login-card" method="POST" action="/supervisor/login">
        <div className="sup-login-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/payez-avec-wave.png" alt="Payez avec Wave" width={140} height={50} />
          <p>Espace supervision · Tabaski 2026</p>
        </div>
        <label className="sup-login-label" htmlFor="sup-pass">Mot de passe</label>
        <input
          id="sup-pass"
          name="password"
          type="password"
          autoComplete="current-password"
          className="sup-login-input"
          required
          autoFocus
        />
        {error ? <p className="sup-login-error" role="alert">Mot de passe incorrect.</p> : null}
        <button className="btn btn--primary sup-login-submit" type="submit">Se connecter</button>
        <p className="sup-login-help">
          Accès réservé à l’équipe Wave. Chef de campagne et superviseurs sur place.
        </p>
      </form>
    </div>
  );
}
