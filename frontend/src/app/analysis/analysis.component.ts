import {
  Component,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, interval, of } from 'rxjs';
import {
  switchMap,
  takeWhile,
  takeUntil,
  startWith,
  catchError,
  tap,
} from 'rxjs/operators';

export type JobStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface BiomechanicsMetrics {
  foot_contact: number;
  foot_off: number;
  turning_point: number;
}

export interface AnalysisJob {
  id: string;
  athlete: string;
  status: JobStatus;
  metrics: BiomechanicsMetrics | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface CreateAnalysisResponse {
  id: string;
  status: JobStatus;
  athlete: string;
  createdAt: string;
}

@Component({
  selector: 'app-analysis',
  templateUrl: './analysis.component.html',
  styleUrls: ['./analysis.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisComponent implements OnDestroy {
  private readonly apiUrl = 'http://localhost:3000';
  private readonly pollIntervalMs = 1500;

  athleteName = '';
  job: AnalysisJob | null = null;
  isSubmitting = false;
  isPolling = false;
  errorMessage: string | null = null;

  // Tears down the active poll loop when a new one starts.
  private readonly stopPolling$ = new Subject<void>();
  // Tears down everything on destroy.
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  submit(): void {
    const athlete = this.athleteName.trim();
    if (!athlete || this.isSubmitting || this.isPolling) {
      return;
    }

    this.reset();
    this.isSubmitting = true;

    this.http
      .post<CreateAnalysisResponse>(`${this.apiUrl}/analysis`, { athlete })
      .pipe(
        takeUntil(this.destroy$),
        catchError((err) => {
          this.fail(this.describeError(err));
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (!res) return;
        this.isSubmitting = false;
        this.job = {
          ...res,
          metrics: null,
          error: null,
          updatedAt: res.createdAt,
          completedAt: null,
        };
        this.cdr.markForCheck();
        this.startPolling(res.id);
      });
  }

  // Poll the job every 1.5s. takeWhile (inclusive) keeps polling while the job
  // is PENDING and lets the final COMPLETED/FAILED value through before the
  // stream completes, so the result renders exactly once.
  private startPolling(id: string): void {
    this.stopPolling$.next();
    this.isPolling = true;

    interval(this.pollIntervalMs)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.http.get<AnalysisJob>(`${this.apiUrl}/analysis/${id}`).pipe(
            catchError((err) => {
              this.fail(this.describeError(err));
              return of(null);
            }),
          ),
        ),
        takeWhile((job) => job?.status === 'PENDING', true),
        takeUntil(this.stopPolling$),
        takeUntil(this.destroy$),
      )
      .subscribe((job) => {
        if (!job) return;
        this.job = job;
        if (job.status !== 'PENDING') {
          this.isPolling = false;
          if (job.status === 'FAILED') {
            this.errorMessage = job.error ?? 'Analysis failed.';
          }
        }
        // OnPush: this update comes from a timer/HTTP callback, not a template
        // event, so the view needs an explicit nudge to re-render.
        this.cdr.markForCheck();
      });
  }

  private reset(): void {
    this.stopPolling$.next();
    this.job = null;
    this.errorMessage = null;
    this.isPolling = false;
    this.isSubmitting = false;
  }

  private fail(message: string): void {
    this.errorMessage = message;
    this.isSubmitting = false;
    this.isPolling = false;
    this.cdr.markForCheck();
  }

  private describeError(err: unknown): string {
    const e = err as { status?: number; error?: { message?: string } };
    if (e?.status === 0) {
      return 'Cannot reach the analysis service. Is the backend running?';
    }
    return e?.error?.message ?? 'Something went wrong. Please try again.';
  }

  ngOnDestroy(): void {
    this.stopPolling$.next();
    this.stopPolling$.complete();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
