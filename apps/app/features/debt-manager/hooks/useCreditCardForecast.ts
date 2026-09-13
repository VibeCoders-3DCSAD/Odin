import { useEffect, useRef, useState } from "react";
import {
  buildCreditCardForecastAsync,
  type CreditCardForecastInput,
} from "../creditCardForecast";

type Forecast = Awaited<ReturnType<typeof buildCreditCardForecastAsync>>;

type ForecastState = {
  forecast: Forecast | null;
  isLoading: boolean;
};

function fingerprint(input: CreditCardForecastInput): string {
  return JSON.stringify(input);
}

export function useCreditCardForecast(input: CreditCardForecastInput | null): ForecastState {
  const inputFingerprint = input ? fingerprint(input) : null;
  const cache = useRef<{ fingerprint: string; forecast: Forecast } | null>(null);
  const requestId = useRef(0);
  const [state, setState] = useState<ForecastState>({ forecast: null, isLoading: false });

  useEffect(() => {
    if (!input || !inputFingerprint) {
      cache.current = null;
      setState({ forecast: null, isLoading: false });
      return;
    }

    const cached = cache.current;
    if (cached?.fingerprint === inputFingerprint) {
      setState({ forecast: cached.forecast, isLoading: false });
      return;
    }

    const currentRequestId = requestId.current + 1;
    requestId.current = currentRequestId;
    setState((current) => ({ forecast: current.forecast, isLoading: true }));

    buildCreditCardForecastAsync(input)
      .then((forecast) => {
        if (requestId.current !== currentRequestId) return;
        cache.current = { fingerprint: inputFingerprint, forecast };
        setState({ forecast, isLoading: false });
      })
      .catch(() => {
        if (requestId.current === currentRequestId) {
          setState((current) => ({ ...current, isLoading: false }));
        }
      });

    return () => {
      if (requestId.current === currentRequestId) requestId.current += 1;
    };
  }, [inputFingerprint]);

  return state;
}
