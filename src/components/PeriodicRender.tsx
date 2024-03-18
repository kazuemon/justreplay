/*
  Refs: https://github.com/justinmahar/react-use-precision-timer/blob/master/src/components/TimerRenderer.tsx
*/

import { useEffect, useState } from "react";
import { Subs } from "react-sub-unsub";

type PeriodicRenderProps = {
	render: () => JSX.Element;
	renderRateMs: number;
};

export const PeriodicRender = ({
	render = () => <></>,
	renderRateMs = 100,
}: PeriodicRenderProps) => {
	const [, setRenderedAt] = useState(Date.now());

	useEffect(() => {
		const subs = new Subs();
		subs.setInterval(() => {
			setRenderedAt(Date.now());
		}, renderRateMs);
		return subs.createCleanup();
	}, [renderRateMs]);

	return render();
};
