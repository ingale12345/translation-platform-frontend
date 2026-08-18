import { create } from "zustand"
import { persist } from "zustand/middleware"

import {
  clearRequestContext,
  setRequestContext,
} from "@/lib/http/request-context"
import type { Id } from "@/types/api"
import type { User } from "@/types/models"

/**
 * Who is signed in, and which tenant they are looking at.
 *
 * Persisted so a refresh does not bounce the user to /login, and mirrored into the HTTP
 * request context on every change so the axios interceptors always send the current token
 * and tenant headers. Nothing else in the app writes those headers.
 */
interface SessionState {
  accessToken: string | null
  user: User | null
  activeProjectId: Id | null
  activeOrganizationId: Id | null

  signIn: (payload: { accessToken: string; user: User }) => void
  signOut: () => void
  setUser: (user: User) => void
  setActiveTenant: (tenant: { projectId: Id; organizationId: Id }) => void
}

const STORAGE_KEY = "lmp.session"

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      activeProjectId: null,
      activeOrganizationId: null,

      signIn: ({ accessToken, user }) => {
        setRequestContext({ accessToken })
        set({ accessToken, user })
      },

      signOut: () => {
        clearRequestContext()
        set({
          accessToken: null,
          user: null,
          activeProjectId: null,
          activeOrganizationId: null,
        })
      },

      setUser: (user) => set({ user }),

      setActiveTenant: ({ projectId, organizationId }) => {
        setRequestContext({ projectId, organizationId })
        set({
          activeProjectId: projectId,
          activeOrganizationId: organizationId,
        })
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        activeProjectId: state.activeProjectId,
        activeOrganizationId: state.activeOrganizationId,
      }),
      /**
       * Rehydration happens after this module is imported but before React renders, so
       * this is where a persisted token gets back into the request context. Without it,
       * the first request after a refresh would go out unauthenticated.
       */
      onRehydrateStorage: () => (state) => {
        if (!state) {
          return
        }

        setRequestContext({
          accessToken: state.accessToken,
          projectId: state.activeProjectId,
          organizationId: state.activeOrganizationId,
        })
      },
    }
  )
)

/** Selectors, so components subscribe to one field instead of the whole store. */
export const selectIsAuthenticated = (state: SessionState) =>
  Boolean(state.accessToken)
export const selectUser = (state: SessionState) => state.user
export const selectActiveProjectId = (state: SessionState) =>
  state.activeProjectId
