import { http } from "@/lib/http/client"
import type {
  AuthenticationRequest,
  AuthenticationResult,
  EffectivePermissions,
  LoginCredentials,
  UserMembership,
} from "@/types/session"
import type { Id } from "@/types/api"

/**
 * The endpoints that answer "who is this, and what may they do?".
 *
 * These are not CRUD resources, so they sit outside `createResourceService` — but they go
 * through the same axios instance, and therefore get the same auth header, tenant headers
 * and error normalisation as everything else.
 */
export const sessionService = {
  /**
   * `POST /authentication`. Opts out of the global 401 handler: a wrong password must
   * read as a failed login, not as an expired session that logs the user out mid-typing.
   */
  async login(credentials: LoginCredentials): Promise<AuthenticationResult> {
    const body: AuthenticationRequest = { strategy: "local", ...credentials }
    const { data } = await http.post<AuthenticationResult>(
      "/authentication",
      body,
      {
        skipAuthRedirect: true,
      }
    )

    return data
  },

  /**
   * `DELETE /authentication`. Best-effort: the client drops the token either way, so a
   * failure here must not leave the user stuck in a session they asked to end.
   */
  async logout(): Promise<void> {
    try {
      await http.delete("/authentication")
    } catch {
      // Token already expired or the server is unreachable — nothing left to revoke.
    }
  },

  /** `GET /me/memberships` — every project the user can enter, with their roles in each. */
  async memberships(): Promise<UserMembership[]> {
    const { data } = await http.get<UserMembership[]>("/me/memberships")

    return data
  },

  /** `GET /me/permissions` — the merged entitlement × action matrix for one project. */
  async permissions(projectId: Id): Promise<EffectivePermissions> {
    const { data } = await http.get<EffectivePermissions>("/me/permissions", {
      params: { projectId },
    })

    return data
  },
}
