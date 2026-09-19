import { Check, Play, X } from 'lucide-react';
import { RUN_STAGES } from '../../utils/constants';
import { cn } from '../../utils/cn';

// stageIndex: the active stage. Use stages.length when everything is done.
export default function RunStepper({ stages = RUN_STAGES, stageIndex, tone = 'primary' }) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-[460px] items-start">
        {stages.map((label, i) => {
          const state = i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'pending';
          const bad = state === 'active' && tone === 'danger';
          return (
            <div key={label} className="relative flex flex-1 flex-col items-center gap-2 text-center">
              {i > 0 && (
                <span
                  className={cn(
                    'absolute left-[-50%] right-[50%] top-4 h-0.5 -translate-y-1/2',
                    i <= stageIndex ? 'bg-success' : 'bg-line'
                  )}
                />
              )}
              <div
                className={cn(
                  'relative z-10 grid size-8 place-items-center rounded-full border-2',
                  state === 'done' && 'border-success bg-success text-white',
                  state === 'active' && !bad && 'border-primary bg-primary text-white',
                  bad && 'border-danger bg-danger text-white',
                  state === 'pending' && 'border-dashed border-muted/50 bg-card text-muted'
                )}
              >
                {state === 'done' ? (
                  <Check className="size-4" />
                ) : bad ? (
                  <X className="size-4" />
                ) : (
                  <Play className="size-3.5" />
                )}
              </div>
              <span className="px-1 text-xs font-medium leading-tight text-ink">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}